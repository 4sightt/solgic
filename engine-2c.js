'use strict';
const ENGINE_2C_VERSION = 'engine-2c v001';

function infer2C(io) {
  const log = [ENGINE_2C_VERSION];
  const bad = (msg) => ({ ok:false, engine:ENGINE_2C_VERSION, mode:'2C', checkLines:[ENGINE_2C_VERSION,msg], mine:[], safe:[], sol:0, exhausted:true });
  try {
    const n = io && (io.size|0), K = io && (io.mines|0);
    if (n < 3 || n > 9) return bad(`unsupported size=${n}; 2C supports 3..9`);
    if (!io || !Array.isArray(io.board) || io.board.length < n) return bad('invalid io.board');
    if (K < 0 || K > n*n) return bad(`invalid mines=${K}`);

    const N = n*n;
    const id = (x,y)=>y*n+x, xOf = i=>i%n, yOf = i=>(i/n)|0;
    const lab = (x,y)=>String.fromCharCode(65+x)+String(y+1);
    const DIRS8=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const DIRS4=[[-1,0],[1,0],[0,-1],[0,1]];
    const DIAG=[[-1,-1],[1,-1],[-1,1],[1,1]];
    const constraints=['2C: every 4-connected mine group is a filled rectangle','2C: all rectangle groups are diagonally connected'];

    function norm(c){
      if (c == null) return {t:'e'};
      if (typeof c === 'number') return {t:'n',v:c|0};
      if (typeof c === 'string') {
        const s=c.trim();
        if (s==='.' || s==='' || s.toLowerCase()==='e') return {t:'e'};
        if (s==='?' || s.toLowerCase()==='q') return {t:'q'};
        if (s.toUpperCase()==='F') return {t:'f'};
        if (/^-?[0-9]+$/.test(s)) return {t:'n',v:parseInt(s,10)|0};
        return {t:'e'};
      }
      const t=String(c.t||c.kind||'').toLowerCase();
      if (t==='e'||t==='empty') return {t:'e'};
      if (t==='q'||t==='?') return {t:'q'};
      if (t==='f'||t==='flag') return {t:'f'};
      if (t==='n'||t==='num'||t==='number') return {t:'n',v:Math.trunc(Number(c.v??c.value??0))};
      return {t:'e'};
    }

    const fixedMine=new Uint8Array(N), fixedSafe=new Uint8Array(N), isNum=new Uint8Array(N), isVar=new Uint8Array(N);
    const numVal=new Int16Array(N).fill(-1), vars=[];
    for (let y=0;y<n;y++) {
      if (!Array.isArray(io.board[y]) || io.board[y].length<n) return bad(`invalid board row ${y+1}`);
      for (let x=0;x<n;x++) {
        const c=norm(io.board[y][x]), i=id(x,y);
        if (c.t==='f') fixedMine[i]=1;
        else if (c.t==='q') fixedSafe[i]=1;
        else if (c.t==='n') {
          if (c.v<0 || c.v>8) return bad(`invalid number ${lab(x,y)}=${c.v|0}`);
          fixedSafe[i]=1; isNum[i]=1; numVal[i]=c.v|0;
        } else { isVar[i]=1; vars.push(i); }
      }
    }
    let totalFlags=0; for (let i=0;i<N;i++) if (fixedMine[i]) totalFlags++;
    if (totalFlags>K) return bad(`contradiction: flags=${totalFlags} exceed mines=${K}`);
    if (totalFlags+vars.length<K) return bad(`contradiction: flags+unknown=${totalFlags+vars.length} < mines=${K}`);

    const clues=[];
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) if (isNum[id(x,y)]) {
      let flags=0; const vn=[];
      for (const [dx,dy] of DIRS8) {
        const xx=x+dx, yy=y+dy; if (xx<0||yy<0||xx>=n||yy>=n) continue;
        const j=id(xx,yy); if (fixedMine[j]) flags++; else if (isVar[j]) vn.push(j);
      }
      const need=numVal[id(x,y)]-flags;
      if (need<0 || need>vn.length) return bad(`contradiction: clue ${lab(x,y)}=${numVal[id(x,y)]} unsatisfiable`);
      clues.push({i:id(x,y),x,y,need,vn});
    }
    const ret=(safeSet,mineSet,why)=>{
      const safe=[...safeSet].map(i=>lab(xOf(i),yOf(i))).sort();
      const mine=[...mineSet].map(i=>lab(xOf(i),yOf(i))).sort();
      log.push(...constraints, why, `deduce: mine=${mine.length} safe=${safe.length}`);
      return {ok:true,engine:ENGINE_2C_VERSION,mode:'2C',safe,mine,sol:undefined,exhausted:true,checkLines:log};
    };

    const safeA=new Set(), mineA=new Set();
    for (const c of clues) { if (c.need===0) c.vn.forEach(j=>safeA.add(j)); else if (c.need===c.vn.length) c.vn.forEach(j=>mineA.add(j)); }
    if (totalFlags===K) vars.forEach(v=>safeA.add(v));
    if (totalFlags+vars.length===K) vars.forEach(v=>mineA.add(v));
    for (const j of safeA) if (mineA.has(j)) return bad(`contradiction: ${lab(xOf(j),yOf(j))} forced safe and mine`);
    if (safeA.size||mineA.size) return ret(safeA,mineA,'deduce(number rule): forced by single clue / total count');

    function enumChoices(arr,need,cb){
      const chosen=[]; (function rec(p,left){
        if (left<0 || arr.length-p<left) return;
        if (p===arr.length) { if (left===0) cb(chosen.slice()); return; }
        rec(p+1,left); chosen.push(arr[p]); rec(p+1,left-1); chosen.pop();
      })(0,need);
    }
    function compsOf(mine){
      const seen=new Uint8Array(N), comps=[];
      for (let i=0;i<N;i++) if (mine[i]&&!seen[i]) {
        const st=[i], cells=[]; seen[i]=1;
        while (st.length) {
          const cur=st.pop(); cells.push(cur); const x=xOf(cur), y=yOf(cur);
          for (const [dx,dy] of DIRS4) { const xx=x+dx, yy=y+dy; if (xx<0||yy<0||xx>=n||yy>=n) continue; const j=id(xx,yy); if (mine[j]&&!seen[j]) {seen[j]=1; st.push(j);} }
        }
        comps.push(cells);
      }
      return comps;
    }
    function bbox(comp){
      let minX=n,maxX=-1,minY=n,maxY=-1;
      for (const i of comp) { const x=xOf(i), y=yOf(i); if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y; }
      return {minX,maxX,minY,maxY};
    }

    const mineRectA=new Set();
    for (const comp of compsOf(fixedMine)) {
      const b=bbox(comp);
      for (let y=b.minY;y<=b.maxY;y++) for (let x=b.minX;x<=b.maxX;x++) {
        const j=id(x,y); if (fixedSafe[j]) return bad(`contradiction: mine component bounding box requires safe ${lab(x,y)}`); if (isVar[j]) mineRectA.add(j);
      }
    }
    if (mineRectA.size) return ret(new Set(),mineRectA,'deduce(2C rectangle): fill current mine component bounding box');

    function rectOptions(comp,mine,safe,mineCount){
      const b=bbox(comp), opts=[];
      for (let x1=0;x1<=b.minX;x1++) for (let x2=b.maxX;x2<n;x2++) for (let y1=0;y1<=b.minY;y1++) for (let y2=b.maxY;y2<n;y2++) {
        let extra=0, ok=true;
        for (let y=y1;y<=y2&&ok;y++) for (let x=x1;x<=x2;x++) { const j=id(x,y); if (safe[j]) {ok=false; break;} if (!mine[j]) extra++; }
        if (ok && mineCount+extra<=K) opts.push({x1,y1,x2,y2,extra});
      }
      return opts;
    }
    function feasible(mine,safe,mineCount){
      let possible=0; for (const v of vars) if (!safe[v]&&!mine[v]) possible++;
      if (mineCount>K || mineCount+possible<K) return false;
      for (const c of clues) {
        let cm=0,und=0; for (const v of c.vn) { if (mine[v]) cm++; else if (!safe[v]) und++; }
        if (cm>c.need || cm+und<c.need) return false;
      }
      return true;
    }
    function closeRects(mine,safe,mineCount){
      if (!feasible(mine,safe,mineCount)) return -1;
      let changed=true;
      while (changed) {
        changed=false;
        for (const comp of compsOf(mine)) {
          const b=bbox(comp);
          for (let y=b.minY;y<=b.maxY;y++) for (let x=b.minX;x<=b.maxX;x++) {
            const j=id(x,y); if (safe[j]) return -1;
            if (!mine[j]) { mine[j]=1; mineCount++; changed=true; if (mineCount>K) return -1; }
          }
        }
        if (!feasible(mine,safe,mineCount)) return -1;
      }
      return mineCount;
    }
    function placeOpt(opt,mine,safe,mineCount){
      const m=new Uint8Array(mine); let cnt=mineCount;
      for (let y=opt.y1;y<=opt.y2;y++) for (let x=opt.x1;x<=opt.x2;x++) { const j=id(x,y); if (safe[j]) return null; if (!m[j]) {m[j]=1; cnt++;} }
      cnt=closeRects(m,safe,cnt); return cnt<0?null:{mine:m,mineCount:cnt};
    }
    function canDiagExit(opt,mine,safe,mineCount){
      const placed=placeOpt(opt,mine,safe,mineCount); if (!placed) return false;
      const corners=[[opt.x1-1,opt.y1-1],[opt.x2+1,opt.y1-1],[opt.x1-1,opt.y2+1],[opt.x2+1,opt.y2+1]];
      for (const [x,y] of corners) {
        if (x<0||y<0||x>=n||y>=n) continue; const j=id(x,y); if (safe[j]) continue;
        const m=new Uint8Array(placed.mine); let cnt=placed.mineCount; if (!m[j]) {m[j]=1; cnt++;}
        if (closeRects(m,safe,cnt)>=0) return true;
      }
      return false;
    }
    function partialBad(assumeMines, assumeSafes){
      const mine=new Uint8Array(fixedMine), safe=new Uint8Array(fixedSafe); let mineCount=totalFlags;
      for (const j of assumeSafes) { if (mine[j]) return true; safe[j]=1; }
      for (const j of assumeMines) { if (safe[j]) return true; if (!mine[j]) {mine[j]=1; mineCount++;} }
      mineCount=closeRects(mine,safe,mineCount); if (mineCount<0) return true;
      const comps=compsOf(mine); if (!comps.length) return false;
      const options=[];
      for (const comp of comps) { const opts=rectOptions(comp,mine,safe,mineCount).filter(o=>placeOpt(o,mine,safe,mineCount)); if (!opts.length) return true; options.push(opts); }
      if (mineCount<K) for (const opts of options) {
        let allMines=false, exit=false;
        for (const o of opts) { const p=placeOpt(o,mine,safe,mineCount); if (p&&p.mineCount===K) allMines=true; if (canDiagExit(o,mine,safe,mineCount)) exit=true; if (allMines||exit) break; }
        if (!allMines&&!exit) return true;
      }
      return false;
    }

    const safeB=new Set(), mineB=new Set();
    for (const c of clues) {
      if (!c.vn.length || c.vn.length>10) continue;
      let viable=0; const alwaysMine=new Uint8Array(N).fill(1), everMine=new Uint8Array(N);
      enumChoices(c.vn,c.need,(mineList)=>{
        const ms=new Set(mineList), safeList=c.vn.filter(v=>!ms.has(v));
        if (partialBad(mineList,safeList)) return;
        viable++;
        for (const v of c.vn) { if (ms.has(v)) everMine[v]=1; else alwaysMine[v]=0; }
      });
      if (!viable) continue;
      for (const v of c.vn) { if (everMine[v]===0) safeB.add(v); else if (alwaysMine[v]===1) mineB.add(v); }
    }
    for (const j of safeB) if (mineB.has(j)) return bad(`contradiction: ${lab(xOf(j),yOf(j))} forced safe and mine`);
    if ((safeB.size||mineB.size) && (n>=6 || vars.length>24)) return ret(safeB,mineB,'deduce(2C local): single clue pattern with immediate rectangle/diagonal contradiction');

    function checkRect(mine){
      for (const comp of compsOf(mine)) {
        const b=bbox(comp); if (comp.length !== (b.maxX-b.minX+1)*(b.maxY-b.minY+1)) return false;
      }
      return true;
    }
    function diagConnected(mine){
      const comp=new Int32Array(N).fill(-1), cells=[]; let nc=0;
      for (let i=0;i<N;i++) if (mine[i]&&comp[i]===-1) {
        const st=[i], list=[]; comp[i]=nc;
        while (st.length) { const cur=st.pop(); list.push(cur); const x=xOf(cur), y=yOf(cur); for (const [dx,dy] of DIRS4) { const xx=x+dx, yy=y+dy; if (xx<0||yy<0||xx>=n||yy>=n) continue; const j=id(xx,yy); if (mine[j]&&comp[j]===-1) {comp[j]=nc; st.push(j);} } }
        cells.push(list); nc++;
      }
      if (nc<=1) return true;
      const par=Array.from({length:nc},(_,i)=>i); const find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;}; const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b;};
      for (let c=0;c<nc;c++) for (const cell of cells[c]) { const x=xOf(cell), y=yOf(cell); for (const [dx,dy] of DIAG) { const xx=x+dx, yy=y+dy; if (xx<0||yy<0||xx>=n||yy>=n) continue; const j=id(xx,yy); if (mine[j]&&comp[j]!==c) union(c,comp[j]); } }
      const r=find(0); for (let c=1;c<nc;c++) if (find(c)!==r) return false; return true;
    }

    const need=K-totalFlags;
    const deg=new Int16Array(N); for (const c of clues) for (const v of c.vn) deg[v]++;
    const searchVars=vars.slice().sort((a,b)=>(deg[b]-deg[a])||(a-b));
    const varPos=new Int32Array(N).fill(-1); searchVars.forEach((v,k)=>varPos[v]=k);
    const varClues=searchVars.map(()=>[]); clues.forEach((c,ci)=>c.vn.forEach(v=>varClues[varPos[v]].push(ci)));
    const curMine=new Int16Array(clues.length), curUnd=clues.map(c=>c.vn.length), bits=new Uint8Array(N);
    for (let i=0;i<N;i++) bits[i]=fixedMine[i];
    const OR=new Uint8Array(N), AND=new Uint8Array(N).fill(1); let sol=0,nodes=0,exhausted=true; const BUDGET=12000000;
    function dfs(k,placed){
      if (!exhausted) return; if (++nodes>BUDGET) {exhausted=false; return;} if (placed>need) return;
      const rem=searchVars.length-k; if (placed+rem<need) return;
      if (k===searchVars.length) { if (placed!==need || !checkRect(bits) || !diagConnected(bits)) return; sol++; for (const v of searchVars) { if (bits[v]) OR[v]=1; else AND[v]=0; } return; }
      const v=searchVars[k], cs=varClues[k];
      const mineFirst=cs.some(ci=>clues[ci].need-curMine[ci] >= curUnd[ci]-(clues[ci].need-curMine[ci]));
      const asSafe=()=>{ let ok=true; for (const ci of cs) {curUnd[ci]--; if (curMine[ci]+curUnd[ci]<clues[ci].need) ok=false;} if (ok) dfs(k+1,placed); for (const ci of cs) curUnd[ci]++; };
      const asMine=()=>{ bits[v]=1; let ok=true; for (const ci of cs) {curMine[ci]++; curUnd[ci]--; if (curMine[ci]>clues[ci].need) ok=false;} if (ok) dfs(k+1,placed+1); for (const ci of cs) {curMine[ci]--; curUnd[ci]++;} bits[v]=0; };
      if (mineFirst) { asMine(); if (!exhausted) return; asSafe(); } else { asSafe(); if (!exhausted) return; asMine(); }
    }
    dfs(0,0);
    if (!exhausted) { log.push(...constraints,'warning: search budget exceeded; no guaranteed 2C deduction'); return {ok:true,engine:ENGINE_2C_VERSION,mode:'2C',warning:'Search budget exceeded; no guaranteed 2C deduction',safe:[],mine:[],sol:undefined,exhausted:false,checkLines:log}; }
    if (sol===0) return bad('contradiction: no legal 2C layout');
    const safe=[], mine=[]; for (const v of searchVars) { if (OR[v]===0) safe.push(lab(xOf(v),yOf(v))); else if (AND[v]===1) mine.push(lab(xOf(v),yOf(v))); }
    safe.sort(); mine.sort(); log.push(...constraints,`deduce(2C exhaustive): intersection of ${sol} legal layout(s)`,`deduce: mine=${mine.length} safe=${safe.length}`);
    return {ok:true,engine:ENGINE_2C_VERSION,mode:'2C',safe,mine,sol,exhausted:true,checkLines:log};
  } catch (e) { return bad('error: '+(e&&e.message?e.message:String(e))); }
}
if (typeof window !== 'undefined') { window.ENGINE_2C_VERSION=ENGINE_2C_VERSION; window.infer2C=infer2C; }
if (typeof module !== 'undefined' && module.exports) module.exports={ENGINE_2C_VERSION,infer2C};
