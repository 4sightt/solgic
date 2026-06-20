// engine-q.js — SOLGIC Quad solver engine
// Interface: function inferQ(io) -> {ok, checkLines, mine:[], safe:[], sol}
// io format: {mode:'Q', size:n, mines:k, board:[[{t,v},...],...]}
// Tile types: t='e' unknown, t='n' number(v=k), t='f' flagged mine, t='q' opened safe
//
// Quad rule: every 2x2 block must contain at least one mine.

'use strict';

const ENGINE_Q_VERSION = 'engine-q v001';

function inferQ(io){
  const checkLines = [ENGINE_Q_VERSION];

  try{
    const n = io && (io.size|0);
    const minesTarget = io && (io.mines|0);

    if(n < 5 || n > 8){
      return fail(`unsupported size=${n}; Quad supports 5..8`);
    }
    if(!io || !Array.isArray(io.board) || io.board.length < n){
      return fail('invalid io.board');
    }
    if(minesTarget < 0 || minesTarget > n*n){
      return fail(`invalid mines=${minesTarget}`);
    }

    const N = n*n;
    const idx = (x,y)=>y*n+x;
    const xy = i => [i%n, (i/n)|0];
    const lbl = (x,y)=>String.fromCharCode(65+x)+String(y+1);
    const popcount = m => {
      let c=0, v=m|0;
      while(v){ v &= v-1; c++; }
      return c;
    };
    const rowBits = (mask,y)=>BigInt(mask) << BigInt(y*n);

    const fixed = new Int8Array(N).fill(-1); // -1 unknown, 0 safe, 1 mine
    const isNum = new Uint8Array(N);
    const numVal = new Int16Array(N).fill(-1);
    const unknown = [];

    function normCell(c){
      if(c == null) return {t:'e'};
      if(typeof c === 'number') return {t:'n', v:c|0};
      if(typeof c === 'string'){
        const s = c.trim();
        if(s === '.' || s === '' || s.toLowerCase() === 'e') return {t:'e'};
        if(s === '?' || s.toLowerCase() === 'q') return {t:'q'};
        if(s.toUpperCase() === 'F' || s.toLowerCase() === 'f') return {t:'f'};
        if(/^-?\d+$/.test(s)) return {t:'n', v:parseInt(s,10)|0};
        return {t:'e'};
      }
      const t = String(c.t || c.kind || '').toLowerCase();
      if(t === 'e' || t === 'empty') return {t:'e'};
      if(t === 'q' || t === '?') return {t:'q'};
      if(t === 'f' || t === 'flag') return {t:'f'};
      if(t === 'n' || t === 'num' || t === 'number'){
        return {t:'n', v:Math.trunc(Number(c.v ?? c.value ?? 0))};
      }
      return {t:'e'};
    }

    for(let y=0;y<n;y++){
      if(!Array.isArray(io.board[y]) || io.board[y].length < n){
        return fail(`invalid board row ${y+1}`);
      }
      for(let x=0;x<n;x++){
        const c = normCell(io.board[y][x]);
        const i = idx(x,y);
        if(c.t === 'f'){
          fixed[i] = 1;
        }else if(c.t === 'q'){
          fixed[i] = 0;
        }else if(c.t === 'n'){
          const v = c.v|0;
          if(v < 0 || v > 8) return fail(`invalid number ${lbl(x,y)}=${v}`);
          fixed[i] = 0;
          isNum[i] = 1;
          numVal[i] = v;
        }else{
          unknown.push(i);
        }
      }
    }

    // Basic fixed-count bound.
    let fixedMines = 0;
    for(let i=0;i<N;i++) if(fixed[i] === 1) fixedMines++;
    if(fixedMines > minesTarget){
      return fail(`contradiction: flags=${fixedMines} exceed mines=${minesTarget}`);
    }
    if(fixedMines + unknown.length < minesTarget){
      return fail(`contradiction: flags+unknown=${fixedMines+unknown.length} < mines=${minesTarget}`);
    }

    // Row masks that respect fixed safe/mine cells.
    const baseRows = [];
    const minRow = [];
    const maxRow = [];
    for(let y=0;y<n;y++){
      const masks = [];
      let mustOne = 0, mustZero = 0;
      for(let x=0;x<n;x++){
        const f = fixed[idx(x,y)];
        if(f === 1) mustOne |= (1 << x);
        else if(f === 0) mustZero |= (1 << x);
      }
      for(let m=0;m<(1<<n);m++){
        if((m & mustOne) !== mustOne) continue;
        if((m & mustZero) !== 0) continue;
        masks.push(m);
      }
      if(!masks.length) return fail(`contradiction: row ${y+1} has no legal masks`);
      baseRows[y] = masks;
      let lo = Infinity, hi = -Infinity;
      for(const m of masks){
        const pc = popcount(m);
        if(pc < lo) lo = pc;
        if(pc > hi) hi = pc;
      }
      minRow[y] = lo;
      maxRow[y] = hi;
    }

    const suffixMin = Array(n+1).fill(0);
    const suffixMax = Array(n+1).fill(0);
    for(let y=n-1;y>=0;y--){
      suffixMin[y] = suffixMin[y+1] + minRow[y];
      suffixMax[y] = suffixMax[y+1] + maxRow[y];
    }

    // Number clues grouped by row.
    const numsByRow = Array.from({length:n},()=>[]);
    for(let y=0;y<n;y++){
      for(let x=0;x<n;x++){
        const i=idx(x,y);
        if(isNum[i]) numsByRow[y].push({x,y,v:numVal[i]|0});
      }
    }

    function hasBit(mask,x){ return ((mask >> x) & 1) !== 0; }
    function countNumAt(x,y,upper,mid,lower){
      let c = 0;
      for(let dy=-1;dy<=1;dy++){
        const yy = y + dy;
        if(yy < 0 || yy >= n) continue;
        const mask = dy < 0 ? upper : (dy > 0 ? lower : mid);
        for(let dx=-1;dx<=1;dx++){
          if(dx === 0 && dy === 0) continue;
          const xx = x + dx;
          if(xx < 0 || xx >= n) continue;
          if(hasBit(mask,xx)) c++;
        }
      }
      return c;
    }

    function validateNumRow(y,upper,mid,lower){
      const row = numsByRow[y];
      for(let k=0;k<row.length;k++){
        const c = row[k];
        if(countNumAt(c.x,c.y,upper,mid,lower) !== c.v) return false;
      }
      return true;
    }

    function validateQuadPair(upper,lower){
      for(let x=0;x<n-1;x++){
        if((((upper | lower) >> x) & 3) === 0) return false;
      }
      return true;
    }

    // Early contradiction checks on fixed cells only.
    for(let y=0;y<n-1;y++){
      let fixedSafe2x2 = false;
      for(let x=0;x<n-1;x++){
        const a=fixed[idx(x,y)], b=fixed[idx(x+1,y)], c=fixed[idx(x,y+1)], d=fixed[idx(x+1,y+1)];
        if(a===0 && b===0 && c===0 && d===0){ fixedSafe2x2 = true; break; }
      }
      if(fixedSafe2x2) return fail('contradiction: a fixed-safe 2x2 block violates Quad');
    }

    // Exact row-DP enumeration. Each state stores all partial assignments that share:
    // previous two row masks and total mine count so far.
    let states = new Map();

    for(const m0 of baseRows[0]){
      const pc = popcount(m0);
      if(pc + suffixMin[1] > minesTarget || pc + suffixMax[1] < minesTarget) continue;
      const key = `-1,${m0},${pc}`;
      const bits = rowBits(m0,0);
      states.set(key, {pp:-1, p:m0, total:pc, count:1n, orBits:bits, andBits:bits});
    }

    if(states.size === 0) return fail('contradiction: no legal first row');

    const STATE_BUDGET = 250000;
    const TRANSITION_BUDGET = 2000000;
    let transitions = 0;
    let budgetExceeded = false;

    for(let y=1;y<n;y++){
      const next = new Map();

      for(const st of states.values()){
        for(const cur of baseRows[y]){
          transitions++;
          if(transitions > TRANSITION_BUDGET){
            budgetExceeded = true;
            break;
          }

          if(!validateQuadPair(st.p, cur)) continue;

          // When current row y is assigned, row y-1 is fully checkable.
          const upper = (y-2 >= 0) ? st.pp : 0;
          if(!validateNumRow(y-1, upper, st.p, cur)) continue;

          const pc = popcount(cur);
          const total = st.total + pc;
          if(total + suffixMin[y+1] > minesTarget) continue;
          if(total + suffixMax[y+1] < minesTarget) continue;

          const bits = rowBits(cur,y);
          const newOr = st.orBits | bits;
          const newAnd = st.andBits | bits;
          const key = `${st.p},${cur},${total}`;
          const old = next.get(key);
          if(old){
            old.count += st.count;
            old.orBits |= newOr;
            old.andBits &= newAnd;
          }else{
            next.set(key, {
              pp: st.p,
              p: cur,
              total,
              count: st.count,
              orBits: newOr,
              andBits: newAnd
            });
          }
        }
        if(budgetExceeded) break;
      }

      if(budgetExceeded) break;
      states = next;
      if(states.size > STATE_BUDGET){
        budgetExceeded = true;
        break;
      }
      if(states.size === 0) return fail(`contradiction: no legal states after row ${y+1}`);
    }

    if(budgetExceeded){
      checkLines.push('Quad: every 2x2 block has at least one mine');
      checkLines.push('OK (budget exceeded)');
      checkLines.push(`states=${states.size} transitions>${TRANSITION_BUDGET}`);
      checkLines.push('deduce: mine=0 safe=0');
      return {ok:true, checkLines, mine:[], safe:[], sol:0, exhausted:false};
    }

    let sol = 0n;
    let globalOr = 0n;
    let globalAnd = null;

    for(const st of states.values()){
      if(st.total !== minesTarget) continue;
      if(!validateNumRow(n-1, n>=2 ? st.pp : 0, st.p, 0)) continue;

      sol += st.count;
      globalOr |= st.orBits;
      globalAnd = (globalAnd === null) ? st.andBits : (globalAnd & st.andBits);
    }

    if(sol === 0n){
      return fail('contradiction: no legal solutions');
    }

    const mine = [];
    const safe = [];
    for(const cell of unknown){
      const bit = 1n << BigInt(cell);
      const [x,y] = xy(cell);
      if((globalAnd & bit) !== 0n) mine.push(lbl(x,y));
      else if((globalOr & bit) === 0n) safe.push(lbl(x,y));
    }

    checkLines.push('Quad: every 2x2 block has at least one mine');
    checkLines.push('OK');
    checkLines.push(`solutions=${sol.toString()}`);
    checkLines.push(`deduce: mine=${mine.length} safe=${safe.length}`);

    return {
      ok:true,
      checkLines,
      mine,
      safe,
      sol: sol <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(sol) : sol.toString(),
      exhausted:true
    };

    function fail(msg){
      return {ok:false, checkLines:[ENGINE_Q_VERSION, msg], mine:[], safe:[], sol:0, exhausted:true};
    }
  }catch(e){
    return {
      ok:false,
      checkLines:[ENGINE_Q_VERSION, 'error: '+(e && e.message ? e.message : String(e))],
      mine:[],
      safe:[],
      sol:0,
      exhausted:true
    };
  }
}

if(typeof window !== 'undefined'){
  window.ENGINE_Q_VERSION = ENGINE_Q_VERSION;
  window.inferQ = inferQ;
}
if(typeof module !== 'undefined' && module.exports){
  module.exports = {ENGINE_Q_VERSION, inferQ};
}
