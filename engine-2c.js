'use strict';
/*
 * engine-2c.js  —  Solgic3 "Connected / 2C" inference engine.
 *
 * Independent engine (does NOT reuse engine-q.js solver logic).
 * Spec: solgic3_2c_solver_source.md
 *
 * 2C constraints (all must hold for a legal final mine layout):
 *   1. Number clue:   each number cell's 8-neighbourhood holds exactly its value in mines.
 *   2. Total mines:   flags + deduced mines == io.mines.
 *   3. Rectangle:     every 4-connected mine component is a full axis-aligned rectangle
 *                     (1xN, Nx1, 2x2, 2x3, MxN ... all allowed).
 *   4. Diagonal net:  all rectangle mine groups form ONE diagonally-connected network.
 *
 * `?` cells (t:'q') are OPENED-SAFE-without-number: never mines, never variables,
 *  give no clue, never proposed as safe/mine. Only hidden 'e' cells are variables.
 *
 * Output principle (avoid order dependency):
 *   - First return cells forced by a single number clue (or the global mine count).
 *   - Only if there are none, fall back to the exhaustive 2C intersection
 *     (cells that are safe / mine in EVERY legal 2C layout).
 *   This keeps the result to the independently-provable 1-step frontier and never
 *   chains one fresh deduction onto another.
 */
const ENGINE_2C_VERSION = 'engine-2c v001';

function infer2C(io) {
  const log = [ENGINE_2C_VERSION];
  const bad = (msg) => ({
    ok: false, engine: ENGINE_2C_VERSION, mode: '2C',
    checkLines: [ENGINE_2C_VERSION, msg], mine: [], safe: [], sol: 0, exhausted: true
  });

  try {
    const n = io && (io.size | 0);
    const K = io && (io.mines | 0);
    if (n < 3 || n > 9) return bad(`unsupported size=${n}; 2C supports 3..9`);
    if (!io || !Array.isArray(io.board) || io.board.length < n) return bad('invalid io.board');
    if (K < 0 || K > n * n) return bad(`invalid mines=${K}`);

    const N = n * n;
    const id = (x, y) => y * n + x;
    const lab = (x, y) => String.fromCharCode(65 + x) + String(y + 1);
    const xOf = (i) => i % n, yOf = (i) => (i / n) | 0;

    // --- normalise a cell into {t:'e'|'q'|'f'|'n', v?} (mirrors engine-q.js) ---
    function cell(c) {
      if (c == null) return { t: 'e' };
      if (typeof c === 'number') return { t: 'n', v: c | 0 };
      if (typeof c === 'string') {
        const s = c.trim();
        if (s === '.' || s === '' || s.toLowerCase() === 'e') return { t: 'e' };
        if (s === '?' || s.toLowerCase() === 'q') return { t: 'q' };
        if (s.toUpperCase() === 'F') return { t: 'f' };
        if (/^-?[0-9]+$/.test(s)) return { t: 'n', v: parseInt(s, 10) | 0 };
        return { t: 'e' };
      }
      const t = String(c.t || c.kind || '').toLowerCase();
      if (t === 'e' || t === 'empty') return { t: 'e' };
      if (t === 'q' || t === '?') return { t: 'q' };
      if (t === 'f' || t === 'flag') return { t: 'f' };
      if (t === 'n' || t === 'num' || t === 'number') return { t: 'n', v: Math.trunc(Number(c.v ?? c.value ?? 0)) };
      return { t: 'e' };
    }

    const fixedMine = new Uint8Array(N); // flags (confirmed mines)
    const isNum = new Uint8Array(N);
    const numVal = new Int16Array(N).fill(-1);
    const isVar = new Uint8Array(N);     // hidden 'e' = inference variable
    const vars = [];

    for (let y = 0; y < n; y++) {
      if (!Array.isArray(io.board[y]) || io.board[y].length < n) return bad(`invalid board row ${y + 1}`);
      for (let x = 0; x < n; x++) {
        const c = cell(io.board[y][x]), i = id(x, y);
        if (c.t === 'f') fixedMine[i] = 1;
        else if (c.t === 'q') { /* opened-safe, no clue, not a variable */ }
        else if (c.t === 'n') {
          if (c.v < 0 || c.v > 8) return bad(`invalid number ${lab(x, y)}=${c.v | 0}`);
          isNum[i] = 1; numVal[i] = c.v | 0;
        } else { isVar[i] = 1; vars.push(i); }
      }
    }

    let totalFlags = 0;
    for (let i = 0; i < N; i++) if (fixedMine[i]) totalFlags++;
    if (totalFlags > K) return bad(`contradiction: flags=${totalFlags} exceed mines=${K}`);
    if (totalFlags + vars.length < K) return bad(`contradiction: flags+unknown=${totalFlags + vars.length} < mines=${K}`);

    // 8-neighbour offsets, 4-neighbour offsets, diagonal offsets
    const DIRS8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    const DIRS4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const DIAG = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

    // ---- precompute clue neighbourhoods ----
    const clues = []; // {i,x,y,need,vn:[varIdx...]}
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = id(x, y);
      if (!isNum[i]) continue;
      let flags = 0; const vn = [];
      for (const [dx, dy] of DIRS8) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
        const j = id(xx, yy);
        if (fixedMine[j]) flags++;
        else if (isVar[j]) vn.push(j);
      }
      const need = numVal[i] - flags;
      if (need < 0 || need > vn.length) return bad(`contradiction: clue ${lab(x, y)}=${numVal[i]} unsatisfiable`);
      clues.push({ i, x, y, need, vn });
    }

    // =====================================================================
    // TIER A — single-clue number deductions + global mine-count edges.
    // Each deduction is independently provable from the current fixed board.
    // =====================================================================
    const safeA = new Set(), mineA = new Set();
    for (const c of clues) {
      if (c.need === 0) for (const j of c.vn) safeA.add(j);
      else if (c.need === c.vn.length) for (const j of c.vn) mineA.add(j);
    }
    if (totalFlags === K) for (const v of vars) safeA.add(v);
    if (totalFlags + vars.length === K) for (const v of vars) mineA.add(v);
    for (const j of safeA) if (mineA.has(j)) return bad(`contradiction: ${lab(xOf(j), yOf(j))} forced safe and mine`);

    // ---- 2C legality checks on a final mine bitmap ----
    function checkRectangles(mine) {
      const seen = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        if (!mine[i] || seen[i]) continue;
        const stack = [i]; seen[i] = 1;
        let cnt = 0, minX = n, maxX = -1, minY = n, maxY = -1;
        while (stack.length) {
          const cur = stack.pop(); cnt++;
          const cx = xOf(cur), cy = yOf(cur);
          if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
          for (const [dx, dy] of DIRS4) {
            const xx = cx + dx, yy = cy + dy;
            if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
            const j = id(xx, yy);
            if (mine[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
          }
        }
        if (cnt !== (maxX - minX + 1) * (maxY - minY + 1)) return false; // hole / L-shape
      }
      return true;
    }

    function diagConnected(mine) {
      // label 4-connected components
      const comp = new Int32Array(N).fill(-1);
      const cells = []; // per-component list of cell ids
      let nc = 0;
      for (let i = 0; i < N; i++) {
        if (!mine[i] || comp[i] !== -1) continue;
        const stack = [i]; comp[i] = nc; const list = [];
        while (stack.length) {
          const cur = stack.pop(); list.push(cur);
          const cx = xOf(cur), cy = yOf(cur);
          for (const [dx, dy] of DIRS4) {
            const xx = cx + dx, yy = cy + dy;
            if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
            const j = id(xx, yy);
            if (mine[j] && comp[j] === -1) { comp[j] = nc; stack.push(j); }
          }
        }
        cells.push(list); nc++;
      }
      if (nc <= 1) return true; // 0 or 1 group => trivially "connected"
      // union-find over components via diagonal contact
      const par = Array.from({ length: nc }, (_, k) => k);
      const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
      const union = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
      for (let c = 0; c < nc; c++) {
        for (const cellId of cells[c]) {
          const cx = xOf(cellId), cy = yOf(cellId);
          for (const [dx, dy] of DIAG) {
            const xx = cx + dx, yy = cy + dy;
            if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
            const j = id(xx, yy);
            if (mine[j] && comp[j] !== c) union(c, comp[j]);
          }
        }
      }
      const root = find(0);
      for (let c = 1; c < nc; c++) if (find(c) !== root) return false;
      return true;
    }

    // =====================================================================
    // TIER B — exhaustive 2C search (only used when Tier A is empty).
    // Enumerate legal layouts, intersect to get always-safe / always-mine.
    // Number + total-count pruning keeps small boards fast; a node budget
    // guards larger boards (then exhausted=false and we return nothing).
    // =====================================================================
    const need = K - totalFlags;                 // mines to place among vars
    const varClues = vars.map(() => []);          // var local index -> clue indices it belongs to
    const varPos = new Int32Array(N).fill(-1);
    vars.forEach((v, k) => varPos[v] = k);
    clues.forEach((c, ci) => c.vn.forEach((v) => varClues[varPos[v]].push(ci)));

    const curMine = new Int16Array(clues.length); // mines assigned among each clue's vn
    const curUnd = clues.map((c) => c.vn.length); // undecided vn count per clue
    const mineBits = new Uint8Array(N);
    for (let i = 0; i < N; i++) mineBits[i] = fixedMine[i];

    const OR = new Uint8Array(N);                 // mine in SOME solution
    const AND = new Uint8Array(N).fill(1);        // mine in EVERY solution
    let sol = 0, nodes = 0, exhausted = true;
    const BUDGET = 3000000;

    function dfs(k, placed) {
      if (!exhausted) return;
      if (++nodes > BUDGET) { exhausted = false; return; }
      if (placed > need) return;
      const remaining = vars.length - k;
      if (placed + remaining < need) return;

      if (k === vars.length) {
        if (placed !== need) return;
        if (!checkRectangles(mineBits)) return;
        if (!diagConnected(mineBits)) return;
        sol++;
        for (const v of vars) { if (mineBits[v]) OR[v] = 1; else AND[v] = 0; }
        return;
      }

      const v = vars[k], cs = varClues[k];

      // branch: v = SAFE
      let ok = true;
      for (const ci of cs) { curUnd[ci]--; if (curMine[ci] + curUnd[ci] < clues[ci].need) ok = false; }
      if (ok) dfs(k + 1, placed);
      for (const ci of cs) curUnd[ci]++;
      if (!exhausted) return;

      // branch: v = MINE
      mineBits[v] = 1; ok = true;
      for (const ci of cs) { curMine[ci]++; curUnd[ci]--; if (curMine[ci] > clues[ci].need) ok = false; }
      if (ok) dfs(k + 1, placed + 1);
      for (const ci of cs) { curMine[ci]--; curUnd[ci]++; }
      mineBits[v] = 0;
    }
    dfs(0, 0);

    // ---------- assemble result ----------
    const constraintLines = [
      '2C: every 4-connected mine group is a filled rectangle',
      '2C: all rectangle groups are diagonally connected'
    ];

    // Prefer Tier A (single-clue number frontier) when it found anything.
    if (safeA.size || mineA.size) {
      const safe = [...safeA].map((i) => lab(xOf(i), yOf(i))).sort();
      const mine = [...mineA].map((i) => lab(xOf(i), yOf(i))).sort();
      log.push(...constraintLines,
        'deduce(number rule): forced by single clue / total count',
        `deduce: mine=${mine.length} safe=${safe.length}`);
      return {
        ok: true, engine: ENGINE_2C_VERSION, mode: '2C',
        safe, mine,
        sol: exhausted ? sol : undefined,
        exhausted,
        checkLines: log
      };
    }

    if (!exhausted) {
      log.push(...constraintLines, 'warning: search budget exceeded; no guaranteed 2C deduction');
      return {
        ok: true, engine: ENGINE_2C_VERSION, mode: '2C',
        warning: 'Search budget exceeded; no guaranteed 2C deduction',
        safe: [], mine: [], sol: undefined, exhausted: false, checkLines: log
      };
    }

    if (sol === 0) return bad('contradiction: no legal 2C layout');

    const safe = [], mine = [];
    for (const v of vars) {
      if (OR[v] === 0) safe.push(lab(xOf(v), yOf(v)));        // never a mine => safe
      else if (AND[v] === 1) mine.push(lab(xOf(v), yOf(v)));  // always a mine => mine
    }
    safe.sort(); mine.sort();
    log.push(...constraintLines,
      `deduce(2C exhaustive): intersection of ${sol} legal layout(s)`,
      `deduce: mine=${mine.length} safe=${safe.length}`);
    return {
      ok: true, engine: ENGINE_2C_VERSION, mode: '2C',
      safe, mine, sol, exhausted: true, checkLines: log
    };
  } catch (e) {
    return bad('error: ' + (e && e.message ? e.message : String(e)));
  }
}

if (typeof window !== 'undefined') {
  window.ENGINE_2C_VERSION = ENGINE_2C_VERSION;
  window.infer2C = infer2C;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ENGINE_2C_VERSION, infer2C };
}
