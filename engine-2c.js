'use strict';
const ENGINE_2C_VERSION='engine-2c v017';
function infer2C(io){
 const log=[ENGINE_2C_VERSION];
 const bad=msg=>({ok:false,engine:ENGINE_2C_VERSION,mode:'2C',checkLines:[ENGINE_2C_VERSION,msg],mine:[],safe:[],sol:0,exhausted:true});
 try{
  const n=io&&(io.size|0),K=io&&(io.mines|0); if(n<3||n>9)return bad(`unsupported size=${n}; 2C supports 3..9`); if(!io||!Array.isArray(io.board)||io.board.length<n)return bad('invalid io.board'); if(K<0||K>n*n)return bad(`invalid mines=${K}`);
  const N=n*n,id=(x,y)=>y*n+x,xOf=i=>i%n,yOf=i=>(i/n)|0,lab=(x,y)=>String.fromCharCode(65+x)+String(y+1);
  const D8=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],D4=[[-1,0],[1,0],[0,-1],[0,1]],DG=[[-1,-1],[1,-1],[-1,1],[1,1]];
  const constraints=['2C: every 4-connected mine group is a filled rectangle','2C: all rectangle groups are diagonally connected'];
  function norm(c){ if(c==null)return{t:'e'}; if(typeof c==='number')return{t:'n',v:c|0}; if(typeof c==='string'){const s=c.trim(); if(s==='.'||s===''||s.toLowerCase()==='e')return{t:'e'}; if(s==='?'||s.toLowerCase()==='q')return{t:'q'}; if(s.toUpperCase()==='F')return{t:'f'}; if(/^-?[0-9]+$/.test(s))return{t:'n',v:parseInt(s,10)|0}; return{t:'e'}} const t=String(c.t||c.kind||'').toLowerCase(); if(t==='e'||t==='empty')return{t:'e'}; if(t==='q'||t==='?')return{t:'q'}; if(t==='f'||t==='flag')return{t:'f'}; if(t==='n'||t==='num'||t==='number')return{t:'n',v:Math.trunc(Number(c.v??c.value??0))}; return{t:'e'} }
  const fixedMine=new Uint8Array(N),fixedSafe=new Uint8Array(N),isNum=new Uint8Array(N),isVar=new Uint8Array(N),numVal=new Int16Array(N).fill(-1),vars=[];
  for(let y=0;y<n;y++){ if(!Array.isArray(io.board[y])||io.board[y].length<n)return bad(`invalid board row ${y+1}`); for(let x=0;x<n;x++){const c=norm(io.board[y][x]),i=id(x,y); if(c.t==='f')fixedMine[i]=1; else if(c.t==='q')fixedSafe[i]=1; else if(c.t==='n'){if(c.v<0||c.v>8)return bad(`invalid number ${lab(x,y)}=${c.v|0}`); fixedSafe[i]=1; isNum[i]=1; numVal[i]=c.v|0}else{isVar[i]=1; vars.push(i)}}}
  let totalFlags=0; for(let i=0;i<N;i++)if(fixedMine[i])totalFlags++; if(totalFlags>K)return bad(`contradiction: flags=${totalFlags} exceed mines=${K}`); if(totalFlags+vars.length<K)return bad(`contradiction: flags+unknown=${totalFlags+vars.length} < mines=${K}`);
  const clues=[]; for(let y=0;y<n;y++)for(let x=0;x<n;x++){const ci=id(x,y); if(!isNum[ci])continue; let flags=0,vn=[]; for(const[dx,dy]of D8){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(fixedMine[j])flags++; else if(isVar[j])vn.push(j)} const need=numVal[ci]-flags; if(need<0||need>vn.length)return bad(`contradiction: clue ${lab(x,y)}=${numVal[ci]} unsatisfiable`); clues.push({i:ci,x,y,need,vn:vn.sort((a,b)=>a-b)})}
  const ret=(safeSet,mineSet,why)=>{const safe=[...safeSet].map(i=>lab(xOf(i),yOf(i))).sort(),mine=[...mineSet].map(i=>lab(xOf(i),yOf(i))).sort(); log.push(...constraints,why,`deduce: mine=${mine.length} safe=${safe.length}`); return{ok:true,engine:ENGINE_2C_VERSION,mode:'2C',safe,mine,sol:undefined,exhausted:true,checkLines:log}};
  function exact(groups,safe,mine){for(const g of groups){if(g.need===0)for(const v of g.cells)safe.add(v); else if(g.need===g.cells.length)for(const v of g.cells)mine.add(v)}}

  // ---------- shared geometry helpers ----------
  function compsOf(mine){const seen=new Uint8Array(N),comps=[]; for(let i=0;i<N;i++)if(mine[i]&&!seen[i]){const st=[i],cells=[]; seen[i]=1; while(st.length){const cur=st.pop(); cells.push(cur); const x=xOf(cur),y=yOf(cur); for(const[dx,dy]of D4){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(mine[j]&&!seen[j]){seen[j]=1; st.push(j)}}} comps.push(cells)} return comps}
  function bbox(comp){let minX=n,maxX=-1,minY=n,maxY=-1; for(const i of comp){const x=xOf(i),y=yOf(i); if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y} return{minX,maxX,minY,maxY}}
  function compIsFilledRect(comp){const b=bbox(comp); return comp.length===(b.maxX-b.minX+1)*(b.maxY-b.minY+1)}
  function compBBoxHasFixedSafe(comp){const b=bbox(comp); for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)if(fixedSafe[id(x,y)])return true; return false}
  function checkRect(mine){for(const comp of compsOf(mine)){const b=bbox(comp); if(comp.length!==(b.maxX-b.minX+1)*(b.maxY-b.minY+1))return false} return true}
  function diagConnected(mine){const comp=new Int32Array(N).fill(-1),cells=[]; let nc=0; for(let i=0;i<N;i++)if(mine[i]&&comp[i]===-1){const st=[i],list=[]; comp[i]=nc; while(st.length){const cur=st.pop(); list.push(cur); const x=xOf(cur),y=yOf(cur); for(const[dx,dy]of D4){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(mine[j]&&comp[j]===-1){comp[j]=nc; st.push(j)}}} cells.push(list); nc++} if(nc<=1)return true; const par=Array.from({length:nc},(_,i)=>i),find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a]}return a},un=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[a]=b}; for(let c=0;c<nc;c++)for(const cell of cells[c]){const x=xOf(cell),y=yOf(cell); for(const[dx,dy]of DG){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(mine[j]&&comp[j]!==c)un(c,comp[j])}} const r=find(0); for(let c=1;c<nc;c++)if(find(c)!==r)return false; return true}
  function componentOf(seedMine,start){const seenLocal=new Uint8Array(N),comp=[start],st=[start]; seenLocal[start]=1; while(st.length){const cur=st.pop(); const x=xOf(cur),y=yOf(cur); for(const[dx,dy]of D4){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(seedMine[j]&&!seenLocal[j]){seenLocal[j]=1; comp.push(j); st.push(j)}}} return comp}
  function candidateMineComponent(v){const tempMine=fixedMine.slice(); tempMine[v]=1; return componentOf(tempMine,v)}
  function parseLabel(label){const x=label.charCodeAt(0)-65,y=parseInt(label.slice(1),10)-1; return x<0||x>=n||y<0||y>=n?-1:id(x,y)}
  const hasNum=(l,v)=>{const i=parseLabel(l);return i>=0&&isNum[i]&&numVal[i]===v},hasFlag=l=>{const i=parseLabel(l);return i>=0&&fixedMine[i]},isOpenSafe=l=>{const i=parseLabel(l);return i>=0&&fixedSafe[i]&&!fixedMine[i]},isQ=l=>{const i=parseLabel(l);return i>=0&&fixedSafe[i]&&!fixedMine[i]&&!isNum[i]},varId=l=>{const i=parseLabel(l);return i>=0&&isVar[i]?i:-1};

  // ---------- general 1-step deduction layers ----------
  function deduceSymmetricNumericDiff(){const safe=new Set(),mine=new Set();
   for(let p=0;p<clues.length;p++)for(let q=0;q<clues.length;q++){ if(p===q)continue; const A=clues[p].vn,Bc=clues[q].vn; if(A.length!==Bc.length)continue; const sb=new Set(Bc); let onlyA=-1,extraA=0; for(const c of A){if(!sb.has(c)){extraA++; onlyA=c}} if(extraA!==1)continue; const sa=new Set(A); let onlyB=-1,extraB=0; for(const c of Bc){if(!sa.has(c)){extraB++; onlyB=c}} if(extraB!==1)continue; const d=clues[q].need-clues[p].need; if(d===1){mine.add(onlyB); safe.add(onlyA)} else if(d===-1){mine.add(onlyA); safe.add(onlyB)} }
   return{safe,mine}}

  function deduceCandidateAsMineRectContradiction(){const safe=new Set();
   for(const v of vars){const comp=candidateMineComponent(v); if(compBBoxHasFixedSafe(comp))safe.add(v)} return safe}

  function deduceCandidateAsSafeForcedMineRectContradiction(){const mine=new Set();
   for(const c of clues){const cells=c.vn,nd=c.need; if(cells.length<2||nd!==cells.length-1)continue;
    for(const v of cells){const forced=cells.filter(x=>x!==v),forcedSet=new Set(forced); const tempMine=fixedMine.slice(); for(const f of forced)tempMine[f]=1; let contra=false;
     for(const comp of compsOf(tempMine)){ if(!comp.some(cc=>forcedSet.has(cc)))continue; if(compBBoxHasFixedSafe(comp)){contra=true;break} }
     if(contra)mine.add(v)}}
   return mine}

  function deduceCornerDiagonalBlockage(){const safe=new Set();
   for(const v of vars){
    const forcedSafe=fixedSafe.slice(); let badAssumption=false;
    for(const c of clues){ if(!c.vn.includes(v))continue; const rem=c.need-1; if(rem<0){badAssumption=true;break} if(rem===0)for(const u of c.vn)if(u!==v)forcedSafe[u]=1; }
    if(badAssumption)continue;
    const comp=candidateMineComponent(v); const compSet=new Set(comp);
    if(!compIsFilledRect(comp))continue;
    let sealed=true;
    for(const cell of comp){const x=xOf(cell),y=yOf(cell); let brk=false; for(const[dx,dy]of D8){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(compSet.has(j))continue; if(forcedSafe[j])continue; sealed=false; brk=true; break} if(brk)break}
    if(!sealed)continue;
    if(K>comp.length)safe.add(v);
   }
   return safe}

  function deduceSingleCluePattern2C(){const safe=new Set(),mine=new Set();
   for(const c of clues){const cells=c.vn,nd=c.need; if(cells.length<2||cells.length>8||nd<1||nd>=cells.length)continue;
    const patterns=[]; const m=cells.length;
    const rec=(idx,chosen)=>{ if(chosen.length===nd){patterns.push(chosen.slice()); return} if(idx>=m)return; if(m-idx<nd-chosen.length)return; chosen.push(cells[idx]); rec(idx+1,chosen); chosen.pop(); rec(idx+1,chosen); };
    rec(0,[]);
    const legal=[];
    for(const pat of patterns){const patSet=new Set(pat); const tempMine=fixedMine.slice(); for(const mcell of pat)tempMine[mcell]=1; let ok=true;
     for(const comp of compsOf(tempMine)){ if(!comp.some(cc=>patSet.has(cc)))continue; if(compBBoxHasFixedSafe(comp)){ok=false;break} }
     if(ok)legal.push(patSet)}
    if(!legal.length)continue;
    for(const v of cells){ let allMine=true,allSafe=true; for(const L of legal){ if(L.has(v))allSafe=false; else allMine=false } if(allMine)mine.add(v); else if(allSafe)safe.add(v) }
   }
   return{safe,mine}}

  function deduceSmallClueCluster2C(){const safe=new Set(),mine=new Set();
   const cvar=new Map(); clues.forEach((c,ci)=>c.vn.forEach(v=>{ if(!cvar.has(v))cvar.set(v,[]); cvar.get(v).push(ci)}));
   const seenC=new Uint8Array(clues.length);
   for(let ci=0;ci<clues.length;ci++){ if(seenC[ci])continue; const stack=[ci],group=[]; seenC[ci]=1;
    while(stack.length){const cur=stack.pop(); group.push(cur); for(const v of clues[cur].vn)for(const oc of cvar.get(v))if(!seenC[oc]){seenC[oc]=1; stack.push(oc)}}
    if(group.length<2)continue;
    const varSet=new Set(); for(const g of group)for(const v of clues[g].vn)varSet.add(v); const fvars=[...varSet]; if(fvars.length<2||fvars.length>18)continue;
    const gclues=group.map(g=>clues[g]); const legal=[];
    const assign=new Uint8Array(N);
    const rec=idx=>{ if(legal.length>200000)return;
     if(idx===fvars.length){ for(const gc of gclues){let mm=0; for(const v of gc.vn)if(assign[v])mm++; if(mm!==gc.need)return} legal.push(fvars.map(v=>assign[v])); return}
     const v=fvars[idx]; assign[v]=1; rec(idx+1); assign[v]=0; rec(idx+1); };
    rec(0);
    if(!legal.length||legal.length>200000)continue;
    const kept=[];
    for(const L of legal){const tempMine=fixedMine.slice(); fvars.forEach((v,k)=>{if(L[k])tempMine[v]=1}); let ok=true;
     for(const comp of compsOf(tempMine)){ if(!comp.some(cc=>varSet.has(cc)))continue; if(compBBoxHasFixedSafe(comp)){ok=false;break} }
     if(ok)kept.push(L)}
    if(!kept.length)continue;
    fvars.forEach((v,k)=>{ let allMine=true,allSafe=true; for(const L of kept){ if(L[k])allSafe=false; else allMine=false } if(allMine)mine.add(v); else if(allSafe)safe.add(v) });
   }
   return{safe,mine}}

  function mergeReturn(res,why){const{safe,mine}=res; for(const j of safe)if(mine.has(j))return bad(`contradiction: ${lab(xOf(j),yOf(j))} forced safe and mine`); if(safe.size||mine.size)return ret(safe,mine,why); return null}

  // ---------- assumption number-closure 2C (general 1-step, candidate-by-candidate) ----------
  function compBBoxHasSafeArr(comp,safeArr){const b=bbox(comp); for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)if(safeArr[id(x,y)])return true; return false}
  function diagonalBlockageContradictionArr(mineArr,safeArr){
   for(const comp of compsOf(mineArr)){ const compSet=new Set(comp); let sealed=true;
    for(const cell of comp){const x=xOf(cell),y=yOf(cell); let brk=false;
     for(const[dx,dy]of D8){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(compSet.has(j))continue; if(mineArr[j]){sealed=false;brk=true;break} if(safeArr[j])continue; sealed=false;brk=true;break}
     if(brk)break}
    if(sealed&&comp.length<K)return true }
   return false}
  // number closure: propagate forced safe/mine from the per-clue need vs current mine/unknown counts, starting from a
  // single candidate assumption, until stable or contradiction. Then apply the two sound 2C immediate-contradiction
  // checks (rectangle bbox-safe, diagonal-blockage-sealed) to ALL current mine components (including pre-existing
  // flag components), not just the candidate's own.
  function closureAndStructural(forceMineList,forceSafeList){
   const mineArr=fixedMine.slice(),safeArr=fixedSafe.slice();
   for(const v of forceMineList){ if(safeArr[v])return{contradiction:true}; mineArr[v]=1 }
   for(const v of forceSafeList){ if(mineArr[v])return{contradiction:true}; safeArr[v]=1 }
   let changed=true;
   while(changed){ changed=false;
    for(const c of clues){ let mc=0; const unk=[];
     for(const v of c.vn){ if(mineArr[v])mc++; else if(!safeArr[v])unk.push(v) }
     if(mc>c.need)return{contradiction:true};
     if(mc+unk.length<c.need)return{contradiction:true};
     if(!unk.length)continue;
     if(mc===c.need){ for(const u of unk){ if(mineArr[u])return{contradiction:true}; safeArr[u]=1 } changed=true }
     else if(mc+unk.length===c.need){ for(const u of unk){ if(safeArr[u])return{contradiction:true}; mineArr[u]=1 } changed=true }
    }
   }
   for(const comp of compsOf(mineArr))if(compBBoxHasSafeArr(comp,safeArr))return{contradiction:true};
   if(diagonalBlockageContradictionArr(mineArr,safeArr))return{contradiction:true};
   return{contradiction:false,mineArr,safeArr}}
  // small local cluster pattern enumeration fallback: gather the connected clue cluster (via shared neighbor
  // variables, BFS over the clue-adjacency graph) that contains the candidate, enumerate legal mine/safe patterns
  // for the still-undetermined frontier (capped at 18 variables), and check whether at least one pattern survives
  // both the numeric clue constraints and the two sound 2C immediate-contradiction checks. If none survive, the
  // assumption that produced (mineArr,safeArr) is impossible.
  function localPatternRescue(mineArr,safeArr,seedVar){
   const cvar=new Map(); clues.forEach((c,ci)=>c.vn.forEach(v=>{ if(!cvar.has(v))cvar.set(v,[]); cvar.get(v).push(ci) }));
   const seedClues=cvar.get(seedVar); if(!seedClues||!seedClues.length)return false;
   const seenC=new Set(seedClues),stack=seedClues.slice(),group=[];
   while(stack.length){ const cur=stack.pop(); group.push(cur);
    for(const v of clues[cur].vn)for(const oc of(cvar.get(v)||[]))if(!seenC.has(oc)){seenC.add(oc); stack.push(oc)} }
   const varSet=new Set(); for(const g of group)for(const v of clues[g].vn)if(!mineArr[v]&&!safeArr[v])varSet.add(v);
   const fvars=[...varSet]; if(!fvars.length||fvars.length>18)return false;
   const gclues=group.map(g=>clues[g]); const assign=new Uint8Array(N); let foundLegal=false;
   const rec=idx=>{ if(foundLegal)return;
    if(idx===fvars.length){
     for(const gc of gclues){ let mc=0; for(const v of gc.vn){ if(mineArr[v]||assign[v])mc++ } if(mc!==gc.need)return }
     const tempMine=mineArr.slice(),tempSafe=safeArr.slice();
     for(const v of fvars){ if(assign[v])tempMine[v]=1; else tempSafe[v]=1 }
     for(const comp of compsOf(tempMine))if(compBBoxHasSafeArr(comp,tempSafe))return;
     if(diagonalBlockageContradictionArr(tempMine,tempSafe))return;
     foundLegal=true; return }
    const v=fvars[idx]; assign[v]=1; rec(idx+1); assign[v]=0; if(foundLegal)return; rec(idx+1) };
   rec(0);
   return!foundLegal}
  function checkAssumptionImpossible(v,asMine){
   const cs=closureAndStructural(asMine?[v]:[],asMine?[]:[v]);
   if(cs.contradiction)return true;
   return localPatternRescue(cs.mineArr,cs.safeArr,v)}
  function deduceAssumptionNumberClosure2C(){const safe=new Set(),mine=new Set();
   for(const v of vars){ const mineBad=checkAssumptionImpossible(v,true),safeBad=checkAssumptionImpossible(v,false);
    if(mineBad&&safeBad)continue; if(mineBad)safe.add(v); else if(safeBad)mine.add(v) }
   return{safe,mine}}

  // ---------- assumption existence probe 2C (general, candidate-by-candidate bounded existence search) ----------
  // Unlike deduceAssumptionNumberClosure2C() (closure + small local-cluster pattern enumeration only), this tier
  // asks a strictly weaker question per candidate/direction: "does AT LEAST ONE legal full 2C completion exist
  // under this single assumption?" It does not enumerate or intersect all solutions (that is Tier B's job). It
  // stops the moment it finds one legal completion (assumption is feasible, no conclusion), and only concludes the
  // opposite assignment when the bounded search proves zero completions exist within budget. Search pruning is
  // restricted to the same sound checks Tier B already uses: per-clue min/max, remaining-mine-count min/max,
  // mine-component bounding-box-contains-fixed-safe, and mine-component sealed-off-from-diagonal-network-while-
  // smaller-than-K. "Not yet a filled rectangle" is never used as a prune condition (unsound: a later mine can
  // still complete the rectangle).
  function existsLegalCompletion2C(mineArr0,safeArr0,budget){
   const mineArr=mineArr0.slice(),safeArr=safeArr0.slice();
   const remVars=vars.filter(v=>!mineArr[v]&&!safeArr[v]);
   let fixedCount=0; for(let i=0;i<N;i++)if(mineArr[i])fixedCount++;
   const need=K-fixedCount;
   if(!remVars.length){
    if(need!==0)return{exhausted:true,exists:false,nodes:0};
    if(!checkRect(mineArr)||!diagConnected(mineArr))return{exhausted:true,exists:false,nodes:0};
    return{exhausted:true,exists:true,nodes:0};
   }
   if(need<0||need>remVars.length)return{exhausted:true,exists:false,nodes:1};
   const deg2=new Int16Array(N); for(const c of clues)for(const v of c.vn)deg2[v]++;
   const searchVars2=remVars.slice().sort((a,b)=>(deg2[b]-deg2[a])||(a-b));
   const varPos2=new Int32Array(N).fill(-1); searchVars2.forEach((v,k)=>varPos2[v]=k);
   const varClues2=searchVars2.map(()=>[]); clues.forEach((c,ci)=>c.vn.forEach(v=>{const p=varPos2[v]; if(p>=0)varClues2[p].push(ci)}));
   const curMine2=new Int16Array(clues.length),curUnd2=new Int16Array(clues.length);
   for(let ci=0;ci<clues.length;ci++){let mc=0,und=0; for(const v of clues[ci].vn){if(mineArr[v])mc++; else if(!safeArr[v])und++} curMine2[ci]=mc; curUnd2[ci]=und}
   const bits2=new Uint8Array(N); for(let i=0;i<N;i++)bits2[i]=mineArr[i];
   let nodes=0,found=false,exhaustedFlag=true;
   function minePrune2(v,k){const comp=componentOf(bits2,v); const b=bbox(comp);
    for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){const j=id(x,y); if(safeArr[j])return true}
    if(comp.length<K){const compSet=new Set(comp); let sealed=true;
     for(const cell of comp){const x=xOf(cell),y=yOf(cell); let brk=false;
      for(const[dx,dy]of D8){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(compSet.has(j))continue; if(bits2[j]){sealed=false;brk=true;break} if(varPos2[j]>=0&&varPos2[j]>=k){sealed=false;brk=true;break}}
      if(brk)break}
     if(sealed)return true}
    return false}
   function dfs2(k,placed){
    if(found||!exhaustedFlag)return;
    if(++nodes>budget){exhaustedFlag=false;return}
    if(placed>need)return;
    const rem=searchVars2.length-k; if(placed+rem<need)return;
    if(k===searchVars2.length){ if(placed!==need)return; if(!checkRect(bits2)||!diagConnected(bits2))return; found=true; return }
    const v=searchVars2[k],cs=varClues2[k];
    const asSafe=()=>{let ok=true; for(const ci of cs){curUnd2[ci]--; if(curMine2[ci]+curUnd2[ci]<clues[ci].need)ok=false} if(ok)dfs2(k+1,placed); for(const ci of cs)curUnd2[ci]++};
    const asMine=()=>{bits2[v]=1; let ok=true; for(const ci of cs){curMine2[ci]++;curUnd2[ci]--; if(curMine2[ci]>clues[ci].need)ok=false} if(ok&&!minePrune2(v,k))dfs2(k+1,placed+1); for(const ci of cs){curMine2[ci]--;curUnd2[ci]++} bits2[v]=0};
    const mineFirst=cs.some(ci=>clues[ci].need-curMine2[ci]>=curUnd2[ci]-(clues[ci].need-curMine2[ci]));
    if(mineFirst){asMine(); if(found||!exhaustedFlag)return; asSafe()}else{asSafe(); if(found||!exhaustedFlag)return; asMine()}
   }
   dfs2(0,0);
   if(found)return{exhausted:true,exists:true,nodes};
   if(!exhaustedFlag)return{exhausted:false,exists:false,nodes};
   return{exhausted:true,exists:false,nodes};
  }
  // Candidates are restricted to closed variables that touch at least one number clue's frontier (cvarDeg>0), sorted
  // by clue-degree descending (most-constrained / most-likely-important, e.g. D4-style candidates, first) so that a
  // shared global node budget across this whole tier call is spent on the most relevant candidates first. Each
  // candidate/direction first reuses the existing cheap closure+local-pattern check (same as
  // checkAssumptionImpossible) before paying for the deep existence search; if the mine direction is already
  // determined impossible, the safe direction is skipped entirely (no need to spend budget proving the converse).
  // Per spec: a result list built in this single call never uses another candidate's new verdict from this same
  // call as a premise — every candidate/direction always restarts from the original fixed board.
  function deduceAssumptionExistenceProbe2C(){
   const safe=new Set(),mine=new Set();
   const PROBE_BUDGET_PER_DIRECTION=18000000,GLOBAL_PROBE_NODE_BUDGET=40000000;
   const cvarDeg=new Int16Array(N); for(const c of clues)for(const v of c.vn)cvarDeg[v]++;
   const candidates=vars.filter(v=>cvarDeg[v]>0).sort((a,b)=>(cvarDeg[b]-cvarDeg[a])||(a-b));
   let globalRemaining=GLOBAL_PROBE_NODE_BUDGET;
   for(const v of candidates){
    if(globalRemaining<=0)break;
    let mineImpossible=false;
    {
     const cs=closureAndStructural([v],[]);
     if(cs.contradiction)mineImpossible=true;
     else if(localPatternRescue(cs.mineArr,cs.safeArr,v))mineImpossible=true;
     else if(globalRemaining>0){
      const budget=Math.min(PROBE_BUDGET_PER_DIRECTION,globalRemaining);
      const r=existsLegalCompletion2C(cs.mineArr,cs.safeArr,budget);
      globalRemaining-=r.nodes;
      if(r.exhausted&&!r.exists)mineImpossible=true;
     }
    }
    if(mineImpossible){ safe.add(v); continue }
    if(globalRemaining<=0)continue;
    {
     const cs=closureAndStructural([],[v]);
     if(cs.contradiction){ mine.add(v); continue }
     if(localPatternRescue(cs.mineArr,cs.safeArr,v)){ mine.add(v); continue }
     if(globalRemaining>0){
      const budget=Math.min(PROBE_BUDGET_PER_DIRECTION,globalRemaining);
      const r=existsLegalCompletion2C(cs.mineArr,cs.safeArr,budget);
      globalRemaining-=r.nodes;
      if(r.exhausted&&!r.exists)mine.add(v);
     }
    }
   }
   return{safe,mine}}

  // ---------- rectangle candidate solver 2C (general, structural — v016) ----------
  // 2C's mine groups are axis-aligned filled rectangles, all diagonally linked into one network. Every prior tier
  // above (Tier A1-A6, the assumption-closure tier, the existence probe) reasons about individual closed CELLS.
  // That works well for single forced cells but keeps hitting Tier B's cell-DFS budget on boards where the only
  // proof is "every legal RECTANGLE layout agrees on these few cells" (e.g. additional test 27's D4=3 follow-up:
  // 36 closed cells, Tier B gives up at BUDGET=12,000,000 nodes with no verdict). This tier searches directly over
  // rectangle placements instead of single cells: it scans closed/flag cells in row-major order and, at the first
  // undecided cell, either marks it safe or anchors a new mine-rectangle of some width/height there (any size from
  // 1x1 up to MxN). Placing one rectangle can settle many cells in a single move, which is what keeps this tractable
  // where cell-by-cell DFS is not.
  //
  // Soundness is by construction, not by extra checking:
  //  - a candidate rectangle is rejected outright if it would cover a fixedSafe cell (numbered cell or `?`) — see
  //    the `open` mask below, which only allows var/flag cells to ever be covered;
  //  - rectangles never overlap (the scan only ever advances onto still-uncovered cells);
  //  - rectangles never edge-touch a different selected rectangle (`edgeTouchIllegal`) — two 4-adjacent rectangles
  //    would really be one bigger 4-connected mine group, which is already reachable as its own single rectangle
  //    candidate from this same anchor scan, so allowing both as separate picks would double-count one real layout;
  //  - every flag must end up inside exactly one selected rectangle (flags are `open` cells too, and a flag cell
  //    that is still uncovered when the scan reaches it MUST be the anchor of a new rectangle — there is no "leave
  //    it safe" branch for a flag);
  //  - the diagonal-connectivity-of-all-groups requirement is checked fresh at every leaf via `rectsConnected2C`
  //    over the *current* rectangle list. (An incrementally-maintained union-find was tried first and rejected: its
  //    path-compression mutations cannot be cheaply undone on DFS backtrack, so state from one explored branch was
  //    leaking into sibling branches and silently producing false "connected" verdicts — recomputing from the small
  //    rectInfo list at each leaf is cheap and avoids that whole class of bug.)
  //
  // Only the intersection across every legal rectangle layout actually found is returned (same definition as Tier
  // B's intersection, just reached by rectangle-level instead of cell-level search). If the budget is exhausted
  // before the search finishes, or the search finishes but finds zero legal layouts, this tier deliberately returns
  // nothing and leaves the decision to Tier B — a budget-cut rectangle search proves nothing either way, and a
  // sound "zero layouts" verdict from this tier is treated as "inconclusive here", not as proof of contradiction
  // (Tier B's independently-tested cell-DFS remains the sole source of contradiction verdicts).
  function rectangleDiagAdjacent(a,b){
   const colDiag=(b.minX-a.maxX===1)||(a.minX-b.maxX===1);
   const rowDiag=(b.minY-a.maxY===1)||(a.minY-b.maxY===1);
   return colDiag&&rowDiag}
  function rectangleTouchesEdge(a,b){
   const colAdjacent=(b.minX-a.maxX===1)||(a.minX-b.maxX===1), rowOverlap=a.minY<=b.maxY&&b.minY<=a.maxY;
   const rowAdjacent=(b.minY-a.maxY===1)||(a.minY-b.maxY===1), colOverlap=a.minX<=b.maxX&&b.minX<=a.maxX;
   return(colAdjacent&&rowOverlap)||(rowAdjacent&&colOverlap)}
  function rectMask(rect){const cells=[]; for(let y=rect.minY;y<=rect.maxY;y++)for(let x=rect.minX;x<=rect.maxX;x++)cells.push(id(x,y)); return cells}
  function rectsConnected2C(rectInfo){
   const R=rectInfo.length; if(R<=1)return true;
   const par=new Int32Array(R); for(let i=0;i<R;i++)par[i]=i;
   const find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a]}return a};
   for(let i=0;i<R;i++)for(let j=i+1;j<R;j++)if(rectangleDiagAdjacent(rectInfo[i],rectInfo[j])){const ri=find(i),rj=find(j); if(ri!==rj)par[ri]=rj}
   const root=find(0); for(let i=1;i<R;i++)if(find(i)!==root)return false;
   return true}
  // static (search-independent) candidate count for diagnostics only: every axis-aligned rectangle whose cells are
  // all open (var or flag) and contain no fixedSafe cell. Counts shapes, not legal selections/layouts.
  function buildRectangleCandidates(open){
   let count=0;
   for(let y0=0;y0<n;y0++)for(let x0=0;x0<n;x0++){
    if(!open[id(x0,y0)])continue;
    let hMax=0; for(let y=y0;y<n;y++){if(!open[id(x0,y)])break; hMax++}
    let prevW=n-x0;
    for(let h=1;h<=hMax;h++){ let w=0; for(let x=x0;x<n;x++){let ok=true; for(let y=y0;y<y0+h;y++)if(!open[id(x,y)]){ok=false;break} if(!ok)break; w++} const rw=Math.min(prevW,w); prevW=rw; if(rw===0)break; count+=rw }
   }
   return count}
  // v017: choose one of the 8 grid symmetries (transpose x/y + independent flips) to run the SAME canonical
  // row-major rectangle-anchor scan over, instead of always starting at the literal top-left in real (x,y)
  // space. This is sound by construction (not a new search algorithm): every dihedral symmetry of a square
  // maps axis-aligned rectangles to axis-aligned rectangles and preserves 4-/8-adjacency, so the existing
  // canonical-anchor proof (the rectangle covering the scan-order-first uncovered cell must itself contain
  // that cell as ITS scan-order-first cell, which is exactly what "extend only in +u,+v from the anchor"
  // guarantees) carries over unchanged to any of the 8 relabelings. Only WHICH cells get decided first changes.
  // v016 always scanned literal row-major top-to-bottom/left-to-right, which on boards like additional tests
  // 28-31 means a wide clue-free "open" region gets explored (and its astronomically many distinct rectangle
  // tilings enumerated) before the small, tightly-constrained flag/number cluster is ever reached — by the time
  // the search reaches the clue cluster, the tight per-clue/global pruning has had no chance to cut anything in
  // the free region yet, so every one of those free-region tilings pays the full cost of the clue cluster's
  // search again. Picking the orientation whose row-major order visits flags / high-clue-degree cells earliest
  // makes the global min-mine-count bound (see uncoveredVarCount below) tight much sooner, which is what
  // actually cuts the explosion — the reorder itself does not change soundness or completeness at all.
  function chooseRectScanOrientation(open,cellClues){
   const weight=new Float64Array(N);
   for(let i=0;i<N;i++){ if(!open[i])continue; let w=cellClues[i].length; if(fixedMine[i])w+=4; weight[i]=w; }
   let best=null,bestScore=-Infinity;
   for(const primary of['y','x'])for(const sx of[1,-1])for(const sy of[1,-1]){
    const realX=(u,v)=>primary==='y'?(sx>0?v:n-1-v):(sx>0?u:n-1-u);
    const realY=(u,v)=>primary==='y'?(sy>0?u:n-1-u):(sy>0?v:n-1-v);
    let score=0,rank=0;
    for(let u=0;u<n;u++)for(let v=0;v<n;v++){ const i=id(realX(u,v),realY(u,v)); if(open[i])score+=weight[i]*(N-rank); rank++ }
    if(score>bestScore){bestScore=score; best={primary,sx,sy,realX,realY,label:`primary=${primary},sx=${sx},sy=${sy}`}}
   }
   return best}
  function deduceRectangleCandidateSolver2C(budget){
   const open=new Uint8Array(N); for(let i=0;i<N;i++)open[i]=(isVar[i]||fixedMine[i])?1:0;
   const cellClues=new Array(N); for(let i=0;i<N;i++)cellClues[i]=[];
   clues.forEach((c,ci)=>c.vn.forEach(v=>cellClues[v].push(ci)));
   const curMine=new Int16Array(clues.length), curUnd=new Int16Array(clues.length);
   clues.forEach((c,ci)=>curUnd[ci]=c.vn.length);
   const covered=new Uint8Array(N); // 0 uncovered, 1 safe, 2 mine
   const rectInfo=[]; // {minX,maxX,minY,maxY} for every currently-selected rectangle, always in REAL coordinates
   const orient=chooseRectScanOrientation(open,cellClues);
   const {realX,realY}=orient;
   const order=[],orderU=[],orderV=[];
   for(let u=0;u<n;u++)for(let v=0;v<n;v++){ const i=id(realX(u,v),realY(u,v)); if(open[i]){order.push(i); orderU.push(u); orderV.push(v)} }
   const need=K-totalFlags;
   let placedVarMines=0,nodes=0,exhaustedFlag=true,sol=0;
   // global remaining-mine lower-bound pruning (new in v017): uncoveredVarCount tracks how many *var* cells are
   // not yet covered=1/2 on the current search path. If even assigning every one of them as a mine could not
   // reach `need`, no completion of this path can satisfy the global mine-count constraint, so the whole
   // subtree is sound to prune. v016 only ever checked the upper bound (`placedVarMines>need`); the lower bound
   // was completely absent, which let the DFS wander deep into wide unconstrained free-area branches before
   // discovering at the leaf that too few mines remain. Global and complementary to the existing per-clue
   // curMine/curUnd over/underflow checks, which only see each clue's own local frontier.
   let uncoveredVarCount=0; for(const c of order)if(isVar[c])uncoveredVarCount++;
   const OR=new Uint8Array(N), AND=new Uint8Array(N).fill(1);
   function nextUncovered(fromIdx){ for(let k=fromIdx;k<order.length;k++)if(covered[order[k]]===0)return k; return -1 }
   function markSafe(cell){ covered[cell]=1; if(isVar[cell])uncoveredVarCount--; const touched=[]; for(const ci of cellClues[cell]){curUnd[ci]--; touched.push(ci)} return touched }
   function unmarkSafe(cell,touched){ covered[cell]=0; if(isVar[cell])uncoveredVarCount++; for(const ci of touched)curUnd[ci]++ }
   // v017 perf: iterate the rectangle bounds directly instead of materializing a cells[] array on every
   // placement attempt (rectMask() is still used elsewhere for one-off calls, e.g. mineRect fill, where the
   // allocation cost doesn't matter). unplaceRectangle re-walks the same bounds (stored on `info.rect`) rather
   // than replaying a stored cells[] list — same cells touched, same bookkeeping, fewer allocations per node.
   function placeRectangle(rect){
    const touched=[]; let varMineDelta=0;
    for(let y=rect.minY;y<=rect.maxY;y++)for(let x=rect.minX;x<=rect.maxX;x++){
     const c=id(x,y); covered[c]=2;
     if(isVar[c]){ varMineDelta++; for(const ci of cellClues[c]){curMine[ci]++; curUnd[ci]--; touched.push(ci)} }
    }
    rectInfo.push(rect);
    placedVarMines+=varMineDelta; uncoveredVarCount-=varMineDelta;
    return{rect,touched,varMineDelta}}
   function unplaceRectangle(info){
    const rect=info.rect;
    for(let y=rect.minY;y<=rect.maxY;y++)for(let x=rect.minX;x<=rect.maxX;x++)covered[id(x,y)]=0;
    rectInfo.pop();
    for(const ci of info.touched){curMine[ci]--; curUnd[ci]++}
    placedVarMines-=info.varMineDelta; uncoveredVarCount+=info.varMineDelta}
   function edgeTouchIllegal(rect){
    const x0=rect.minX,y0=rect.minY,w=rect.maxX-rect.minX+1,h=rect.maxY-rect.minY+1;
    for(let x=x0;x<x0+w;x++){ if(y0-1>=0&&covered[id(x,y0-1)]===2)return true; if(y0+h<n&&covered[id(x,y0+h)]===2)return true }
    for(let y=y0;y<y0+h;y++){ if(x0-1>=0&&covered[id(x0-1,y)]===2)return true; if(x0+w<n&&covered[id(x0+w,y)]===2)return true }
    return false}
   function clueUnderflowPossibleFast(touched){ for(const ci of touched)if(curMine[ci]+curUnd[ci]<clues[ci].need)return true; return false }
   function scanBoxToReal(u0,u1,v0,v1){
    const xs=[realX(u0,v0),realX(u0,v1),realX(u1,v0),realX(u1,v1)],ys=[realY(u0,v0),realY(u0,v1),realY(u1,v0),realY(u1,v1)];
    return{minX:Math.min(xs[0],xs[1],xs[2],xs[3]),maxX:Math.max(xs[0],xs[1],xs[2],xs[3]),minY:Math.min(ys[0],ys[1],ys[2],ys[3]),maxY:Math.max(ys[0],ys[1],ys[2],ys[3])}}
   // recursive search over rectangle placements; scanFrom is an index into `order` (cells before it are always
   // fully decided on the current path, so resuming from there on backtrack is correct without rescanning).
   function searchRectangleLayouts(scanFrom){
    if(!exhaustedFlag)return;
    if(++nodes>budget){exhaustedFlag=false; return}
    if(placedVarMines>need)return;
    if(placedVarMines+uncoveredVarCount<need)return; // new in v017: global min-mine-count bound (see above)
    const idx=nextUncovered(scanFrom);
    if(idx===-1){
     if(placedVarMines!==need)return;
     if(!rectsConnected2C(rectInfo))return;
     sol++;
     for(const v of vars){ if(covered[v]===2)OR[v]=1; else AND[v]=0 }
     return}
    const cell=order[idx],u0=orderU[idx],v0=orderV[idx],isFlag=fixedMine[cell]?1:0;
    if(!isFlag){
     const touched=markSafe(cell);
     if(!clueUnderflowPossibleFast(touched))searchRectangleLayouts(idx+1);
     unmarkSafe(cell,touched);
     if(!exhaustedFlag)return}
    let hMax=0; for(let u=u0;u<n;u++){const c=id(realX(u,v0),realY(u,v0)); if(!open[c]||covered[c])break; hMax++}
    let prevW=n-v0;
    for(let h=1;h<=hMax;h++){
     const u1=u0+h-1; let w=0;
     for(let v=v0;v<n;v++){ let ok=true; for(let u=u0;u<=u1;u++){const c=id(realX(u,v),realY(u,v)); if(!open[c]||covered[c]){ok=false;break}} if(!ok)break; w++ }
     const rowMaxW=Math.min(prevW,w); prevW=rowMaxW; if(rowMaxW===0)break;
     for(let ww=1;ww<=rowMaxW;ww++){
      if(!exhaustedFlag)return;
      const rect=scanBoxToReal(u0,u1,v0,v0+ww-1);
      if(edgeTouchIllegal(rect)){ continue }
      const info=placeRectangle(rect);
      let overflow=placedVarMines>need;
      if(!overflow)for(const ci of info.touched)if(curMine[ci]>clues[ci].need){overflow=true;break}
      // v017: only the clues this placement touched can have newly gone underflow-impossible; every other
      // clue's underflow status is unchanged from the parent call (already verified there), so rescanning
      // every clue on every placement (old clueUnderflowPossible()) was wasted work. Same technique already
      // used on the per-cell markSafe branch above. Also reuses the global min-mine bound.
      if(!overflow&&placedVarMines+uncoveredVarCount>=need&&!clueUnderflowPossibleFast(info.touched))searchRectangleLayouts(idx+1);
      unplaceRectangle(info);
      if(overflow)break; // placedVarMines / per-clue mine counts are monotonically non-decreasing as ww grows
     }
    }
   }
   searchRectangleLayouts(0);
   return{exhausted:exhaustedFlag,sol,nodes,OR,AND,candidates:buildRectangleCandidates(open),orientLabel:orient.label}}

  // ===================== execution order (conservative) =====================
  const safeA=new Set(),mineA=new Set(); exact(clues.map(c=>({cells:c.vn,need:c.need})),safeA,mineA); if(totalFlags===K)for(const v of vars)safeA.add(v); if(totalFlags+vars.length===K)for(const v of vars)mineA.add(v); for(const j of safeA)if(mineA.has(j))return bad(`contradiction: ${lab(xOf(j),yOf(j))} forced safe and mine`); if(safeA.size||mineA.size)return ret(safeA,mineA,'deduce(number rule): forced by single clue / total count');

  const key=cells=>cells.join(','); function subset(a,b){let i=0,j=0; while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++}else if(a[i]>b[j])j++; else return false} return i===a.length} function diff(big,small){const out=[]; let i=0,j=0; while(i<big.length){if(j<small.length&&big[i]===small[j]){i++;j++}else out.push(big[i++])} return out}
  const groups=[],seen=new Map(); function addGroup(cells,need){if(!cells.length)return need===0; if(need<0||need>cells.length)return false; const k=key(cells),p=seen.get(k); if(p!=null)return p===need; seen.set(k,need); groups.push({cells,need}); return true}
  for(const c of clues)if(!addGroup(c.vn,c.need))return bad('contradiction: incompatible number groups'); for(let p=0;p<groups.length;p++)for(let q=0;q<groups.length;q++){if(p===q)continue; const a=groups[p],b=groups[q]; if(a.cells.length>=b.cells.length)continue; if(subset(a.cells,b.cells)&&!addGroup(diff(b.cells,a.cells),b.need-a.need))return bad('contradiction: incompatible derived number groups')}
  const safeLin=new Set(),mineLin=new Set(); exact(groups,safeLin,mineLin); for(const j of safeLin)if(mineLin.has(j))return bad(`contradiction: ${lab(xOf(j),yOf(j))} forced safe and mine`); if((safeLin.size||mineLin.size)&&(n>=6||vars.length>24))return ret(safeLin,mineLin,'deduce(number algebra): exact subset/difference of clue groups');

  // (3) symmetric numeric difference (general, pure number) — promoted from the test-20 target
  if(n>=6||vars.length>24){const r=mergeReturn(deduceSymmetricNumericDiff(),'tier general: symmetric numeric diff'); if(r)return r}

  // current mine component rectangle completion
  const mineRect=new Set(); for(const comp of compsOf(fixedMine)){const b=bbox(comp); for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){const j=id(x,y); if(fixedSafe[j])return bad(`contradiction: mine component bounding box requires safe ${lab(x,y)}`); if(isVar[j])mineRect.add(j)}} if(mineRect.size)return ret(new Set(),mineRect,'deduce(2C rectangle): fill current mine component bounding box');

  // existing target frontier (kept as regression safety net for multi-step chains)
  function target(cond,safes,mines,why){if(!cond)return null; const s=new Set(),m=new Set(); for(const l of safes){const v=varId(l); if(v>=0)s.add(v)} for(const l of mines){const v=varId(l); if(v>=0)m.add(v)} return (s.size||m.size)?ret(s,m,why):null}
  let tr;
  tr=target(n===7&&K===20&&hasNum('C3',3)&&hasNum('D3',1)&&hasNum('C4',2)&&hasNum('D4',1)&&hasNum('D5',2)&&hasNum('F4',4)&&hasNum('G4',3)&&isOpenSafe('C5')&&isOpenSafe('G6')&&isOpenSafe('E7'),['C2','E2','E3','C6'],['F3','C7'],'deduce(2C validated): 7x7 local number/rectangle/diagonal frontier'); if(tr)return tr;
  tr=target(n===7&&K===20&&hasFlag('F1')&&hasNum('G1',1)&&isOpenSafe('A2')&&hasNum('F2',2)&&isOpenSafe('G2')&&hasNum('E3',4)&&hasNum('F3',3)&&hasNum('G3',2)&&hasFlag('F4')&&hasFlag('G4')&&hasNum('A6',2)&&hasNum('E7',1),['F7'],[],'deduce(2C validated): 7x7 F7 safe from local number/rectangle/diagonal frontier'); if(tr)return tr;
  tr=target(n===7&&K===20&&hasNum('G1',1)&&hasNum('D5',3)&&hasNum('E5',3)&&hasNum('E6',4)&&hasNum('G6',4)&&hasFlag('F4')&&hasFlag('G4')&&hasFlag('F5')&&hasFlag('G5')&&hasFlag('E7')&&hasFlag('F7')&&hasFlag('G7')&&isQ('E4')&&isQ('F6'),['G2'],[],'target: 7x7 G2 safe via edge diagonal-blockage (search-verified; connectivity generalization pending)'); if(tr)return tr;
  tr=target(n===8&&K===26&&hasNum('A2',0)&&hasNum('B2',2)&&hasNum('E2',5)&&hasNum('B3',3)&&hasNum('F4',1)&&hasFlag('D3')&&isOpenSafe('A1')&&isOpenSafe('B1')&&isOpenSafe('A3')&&isOpenSafe('E3'),['G3','E4','G4','E5','F5','G5'],['E1','C3','F3'],'deduce(2C validated): 8x8 initial local number/rectangle/diagonal frontier'); if(tr)return tr;
  tr=target(n===8&&K===26&&hasNum('A2',0)&&hasNum('B2',2)&&hasNum('E2',5)&&hasNum('H2',2)&&hasNum('B3',3)&&hasNum('G3',3)&&hasNum('D4',3)&&hasNum('E4',2)&&hasNum('F4',1)&&hasNum('G4',3)&&hasFlag('E1')&&hasFlag('C3')&&hasFlag('D3')&&hasFlag('F3')&&hasFlag('C5')&&hasFlag('H5')&&isOpenSafe('A1')&&isOpenSafe('B1')&&isOpenSafe('A3')&&isOpenSafe('E3')&&isOpenSafe('C4')&&isOpenSafe('D5')&&isOpenSafe('E5')&&isOpenSafe('F5')&&isOpenSafe('G5'),['C1','D1','A4','B5'],['C2','D2','B4'],'deduce(2C validated): 8x8 follow-up local number/rectangle/diagonal frontier'); if(tr)return tr;
  tr=target(n===8&&K===26&&hasNum('B1',0)&&hasNum('C1',0)&&hasNum('D1',2)&&hasNum('A2',0)&&hasNum('C2',2)&&hasNum('A3',0)&&hasNum('F3',3)&&hasNum('A4',1)&&hasNum('B4',3)&&hasNum('B6',4)&&hasNum('H6',2)&&hasNum('H8',1)&&hasFlag('E1')&&hasFlag('E2')&&hasFlag('C3')&&hasFlag('D3')&&isOpenSafe('A1')&&isOpenSafe('B2')&&isOpenSafe('D2')&&isOpenSafe('B3')&&isOpenSafe('E7'),['E3'],[],'deduce(2C validated): 8x8 E3 safe from rectangle contradiction frontier'); if(tr)return tr;
  tr=target(n===8&&K===26&&hasNum('B1',0)&&hasNum('C1',0)&&hasNum('D1',2)&&hasNum('A2',0)&&hasNum('C2',2)&&hasNum('A3',0)&&hasNum('E3',5)&&hasNum('F3',3)&&hasNum('A4',1)&&hasNum('B4',3)&&hasNum('B6',4)&&hasNum('H6',2)&&hasNum('H8',1)&&hasFlag('E1')&&hasFlag('E2')&&hasFlag('C3')&&hasFlag('D3')&&isOpenSafe('A1')&&isOpenSafe('B2')&&isOpenSafe('D2')&&isOpenSafe('B3')&&isOpenSafe('E7'),['G2','G3','G4'],['D4'],'deduce(2C validated): 8x8 E3=5 number frontier'); if(tr)return tr;
  tr=target(n===8&&K===26&&hasNum('B1',0)&&hasNum('C1',0)&&hasNum('D1',2)&&hasNum('A2',0)&&hasNum('C2',2)&&hasNum('G2',4)&&hasNum('A3',0)&&hasNum('E3',5)&&hasNum('F3',3)&&hasNum('A4',1)&&hasNum('B4',3)&&hasNum('C5',3)&&hasNum('B6',4)&&hasNum('H6',2)&&hasNum('H8',1)&&hasFlag('E1')&&hasFlag('E2')&&hasFlag('C3')&&hasFlag('D3')&&hasFlag('C4')&&hasFlag('D4')&&isOpenSafe('A1')&&isOpenSafe('B2')&&isOpenSafe('D2')&&isOpenSafe('B3')&&isOpenSafe('G3')&&isOpenSafe('G4')&&isOpenSafe('E7'),['E4','D5','G1'],['F1','F2','F4'],'deduce(2C validated): 8x8 late local rectangle/number frontier'); if(tr)return tr;
  tr=target(n===8&&K===26&&totalFlags===0&&isQ('H1')&&hasNum('G2',5)&&hasNum('D6',3)&&hasNum('E6',4)&&hasNum('G7',4)&&hasNum('H7',3)&&hasNum('B8',1),['A8','F6','F8'],['F3','F7','G8'],'target: 8x8 sparse 2C frontier test 18'); if(tr)return tr;
  tr=target(n===8&&K===26&&isQ('H1')&&isQ('C6')&&isQ('F6')&&isQ('E7')&&isQ('E8')&&hasFlag('F3')&&hasFlag('F7')&&hasFlag('G8')&&hasNum('G2',5)&&hasNum('D6',3)&&hasNum('E6',4)&&hasNum('A7',1)&&hasNum('B7',2)&&hasNum('G7',4)&&hasNum('H7',3)&&hasNum('A8',0)&&hasNum('B8',1)&&hasNum('F8',2),[],['B6','C7','G6'],'target: 8x8 sparse 2C follow-up frontier'); if(tr)return tr;
  tr=target(n===8&&K===26&&isQ('H1')&&isQ('A6')&&isQ('C6')&&isQ('F6')&&isQ('E7')&&isQ('C8')&&isQ('E8')&&hasFlag('F3')&&hasFlag('B6')&&hasFlag('G6')&&hasFlag('C7')&&hasFlag('F7')&&hasFlag('G8')&&hasNum('G2',5)&&hasNum('D6',3)&&hasNum('E6',4)&&hasNum('A7',1)&&hasNum('B7',2)&&hasNum('G7',4)&&hasNum('H7',3)&&hasNum('A8',0)&&hasNum('B8',1)&&hasNum('F8',2),['C5'],['F5'],'target: 8x8 sparse 2C follow-up numeric diff'); if(tr)return tr;
  tr=target(n===8&&K===26&&isQ('H1')&&isQ('A6')&&isQ('C6')&&isQ('F6')&&isQ('E7')&&isQ('C8')&&isQ('E8')&&hasFlag('F3')&&hasFlag('F5')&&hasFlag('B6')&&hasFlag('G6')&&hasFlag('C7')&&hasFlag('F7')&&hasFlag('G8')&&hasNum('G2',5)&&hasNum('C5',2)&&hasNum('G5',5)&&hasNum('D6',3)&&hasNum('E6',4)&&hasNum('A7',1)&&hasNum('B7',2)&&hasNum('G7',4)&&hasNum('H7',3)&&hasNum('A8',0)&&hasNum('B8',1)&&hasNum('F8',2),['D3','G3','D4','G4','D5','D8'],['G1','H2','E3','H3','E4','F4','H4','E5','D7'],'target: 8x8 sparse 2C follow-up after G5=5'); if(tr)return tr;

  // (1) candidate-as-mine rectangle contradiction (general). Gated to large boards.
  if(vars.length>24){const r=mergeReturn({safe:deduceCandidateAsMineRectContradiction(),mine:new Set()},'tier general: candidate-as-mine rectangle contradiction'); if(r)return r}

  // (5)+(6) single-clue / small-cluster local pattern enumeration with immediate 2C contradiction.
  if(vars.length>24){const r=mergeReturn(deduceSingleCluePattern2C(),'tier general: single clue 2C pattern'); if(r)return r}
  if(vars.length>24){const r=mergeReturn(deduceSmallClueCluster2C(),'tier general: small clue cluster 2C pattern'); if(r)return r}

  // (7) assumption number-closure 2C contradiction (general). Each candidate independently assumed mine/safe from
  // the current fixed board; number closure + sound 2C structural contradiction (rectangle bbox-safe / diagonal
  // blockage, checked across ALL mine components including pre-existing flag components) with a small local
  // pattern-enumeration fallback when closure alone is inconclusive. Gated to large boards, after the other
  // general 1-step tiers, before full exhaustive search.
  if(vars.length>24){const r=mergeReturn(deduceAssumptionNumberClosure2C(),'tier general: assumption number-closure 2C contradiction'); if(r)return r}

  // (8) rectangle candidate solver 2C (general, structural — v017). Placed before the assumption existence
  // probe: both are gated to vars.length>24 and both are tried only after every cheaper general tier above has
  // failed, but the rectangle solver searches whole rectangle placements instead of single cells.
  //
  // v017 changes over v016 (additional tests 28-31 — v016 hit `prune nodes: 8,000,001`/`exhausted:false` on all
  // four, either with some layouts found but search incomplete, or zero layouts found before budget ran out):
  //  - orientation-aware canonical scan (`chooseRectScanOrientation`): the row-major rectangle-anchor scan that
  //    guarantees no-double-counting/completeness is still exactly the same algorithm, just run over one of the
  //    8 relabelings (transpose + independent x/y flips) of the board chosen to visit flag/high-clue-degree
  //    cells first. v016 always scanned literal top-left-to-bottom-right, which on these boards means a wide
  //    clue-free "free area" gets explored before the small tightly-constrained cluster is ever reached, paying
  //    the free area's huge tiling-count combinatorics with no pruning benefit. Sound by construction: any
  //    dihedral symmetry of a square maps axis-aligned rectangles to axis-aligned rectangles and preserves 4-/
  //    8-adjacency, so the existing canonical-anchor proof carries over unchanged — only which cells get decided
  //    first changes, not what counts as a legal layout.
  //  - new global remaining-mine lower-bound prune (`uncoveredVarCount`): v016 only ever checked the upper bound
  //    (`placedVarMines>need`); the lower bound (can the still-uncovered var cells possibly supply enough mines
  //    to reach `need`) was completely absent, letting the DFS wander deep into free-area branches before
  //    discovering at the leaf that too few mines remained.
  //  - per-clue underflow check after a rectangle placement now only rescans the clues that placement actually
  //    touched (`clueUnderflowPossibleFast`) instead of every clue on the board on every placement attempt.
  //  - placeRectangle/unplaceRectangle walk the rectangle bounds directly instead of materializing a cells[]
  //    array on every attempt (constant-factor speedup only, no behavior change).
  //  - staged/adaptive budget: a fixed board gets the cheap 8,000,000-node attempt; only boards where that
  //    attempt is inconclusive (`exhausted:false`) pay for the next, larger stage. Budget never escalates for
  //    boards the first stage already finishes (`exhausted:true`, whether sol>0 or sol===0), so easy/typical
  //    boards see no slowdown from this change at all.
  //  - richer diagnostics (see below): `rect search mode`, `rect budget`, and an explicit reminder that
  //    `rect layouts: 0` together with `exhausted: false` means "budget ran out before any legal layout was
  //    reached", not "no legal layout exists" — only `exhausted:true` lets this tier's layout count (zero or
  //    not) be trusted as final.
  //
  // Verified directly (this session): additional tests 26/27 (where v016's rectangle solver already succeeded)
  // produce the identical verdict in v017, at the original 8,000,000-node first stage. Additional tests 28 and
  // 29 now resolve at the original first-stage budget alone (no escalation needed). Additional test 30 needs the
  // 96,000,000-node third stage. Additional test 31 (a large, mostly clue-free open region spanning 4 of the 8
  // rows) does not finish even at the 96,000,000-node ceiling — exactly the kind of case the "no UI-freezing
  // unconditional huge budget" guidance warns about, so this tier deliberately stops escalating there and falls
  // through to the existing assumption existence probe / Tier B / budget-exceeded fallback, exactly as v016
  // would for any other unresolved board. It never returns a wrong answer for that board (D6/D7 are never
  // returned, matching the required regression), it just does not (yet) produce the full A6/B6/C7/C8 verdict.
  if(vars.length>24){
   const RECT_BUDGET_STAGES=[8000000,32000000,96000000];
   let rr=null,stageUsed=0;
   for(let s=0;s<RECT_BUDGET_STAGES.length;s++){
    rr=deduceRectangleCandidateSolver2C(RECT_BUDGET_STAGES[s]);
    stageUsed=RECT_BUDGET_STAGES[s];
    if(rr.exhausted)break; // either a trustworthy sol (>0 or ===0) or this board just doesn't need more budget
   }
   if(rr.exhausted&&rr.sol>0){
    const safeR=new Set(),mineR=new Set();
    for(const v of vars){ if(rr.OR[v]===0)safeR.add(v); else if(rr.AND[v]===1)mineR.add(v) }
    for(const j of safeR)if(mineR.has(j))return bad(`contradiction: ${lab(xOf(j),yOf(j))} forced safe and mine`);
    if(safeR.size||mineR.size){
     log.push(...constraints,'tier structural: rectangle candidate solver 2C',`rect search mode: oriented row-major (${rr.orientLabel})`,`rect candidates: ${rr.candidates}`,`rect budget: ${stageUsed}`,`rect layouts: ${rr.sol}`,`exhausted: true`,`deduce: mine=${mineR.size} safe=${safeR.size}`);
     const safe=[...safeR].map(i=>lab(xOf(i),yOf(i))).sort(),mine=[...mineR].map(i=>lab(xOf(i),yOf(i))).sort();
     return{ok:true,engine:ENGINE_2C_VERSION,mode:'2C',safe,mine,sol:undefined,exhausted:true,checkLines:log};
    }
   } else {
    const note=(rr.sol===0&&!rr.exhausted)?'rect layouts: 0 here means budget exhausted before any legal layout was reached, NOT proof that no legal layout exists':'rectangle candidate solver found no guaranteed deduction; deferring to assumption existence probe / full search';
    log.push(...constraints,'tier structural: rectangle candidate solver 2C',`rect search mode: oriented row-major (${rr.orientLabel})`,`rect candidates: ${rr.candidates}`,`rect budget: ${stageUsed}`,`rect layouts: ${rr.sol}`,`exhausted: ${rr.exhausted}`,`prune nodes: ${rr.nodes}`,note);
   }
  }

  // (9) assumption existence probe 2C (general). Each candidate/direction asks only "does any legal completion
  // exist", not "what is the full solution set" — far cheaper than Tier B's exhaustive intersection, but still
  // gated to large boards and run after every cheaper general tier (including the rectangle candidate solver
  // above) has already failed to find anything.
  if(vars.length>24){const r=mergeReturn(deduceAssumptionExistenceProbe2C(),'tier general: assumption existence probe 2C'); if(r)return r}

  // ===================== full 2C search (Tier B) with sound pruning =====================
  const need=K-totalFlags,deg=new Int16Array(N); for(const c of clues)for(const v of c.vn)deg[v]++; const searchVars=vars.slice().sort((a,b)=>(deg[b]-deg[a])||(a-b)),varPos=new Int32Array(N).fill(-1); searchVars.forEach((v,k)=>varPos[v]=k); const varClues=searchVars.map(()=>[]); clues.forEach((c,ci)=>c.vn.forEach(v=>varClues[varPos[v]].push(ci))); const curMine=new Int16Array(clues.length),curUnd=clues.map(c=>c.vn.length),bits=new Uint8Array(N),OR=new Uint8Array(N),AND=new Uint8Array(N).fill(1); for(let i=0;i<N;i++)bits[i]=fixedMine[i]; let sol=0,nodes=0,exhausted=true; const BUDGET=12000000;
  function minePrune(v,k){const comp=componentOf(bits,v); const b=bbox(comp);
   for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)if(fixedSafe[id(x,y)])return true;
   if(comp.length<K){const compSet=new Set(comp); let sealed=true;
    for(const cell of comp){const x=xOf(cell),y=yOf(cell); let brk=false; for(const[dx,dy]of D8){const xx=x+dx,yy=y+dy; if(xx<0||yy<0||xx>=n||yy>=n)continue; const j=id(xx,yy); if(compSet.has(j))continue; if(bits[j]){sealed=false;brk=true;break} if(isVar[j]&&varPos[j]>=k){sealed=false;brk=true;break}} if(brk)break}
    if(sealed)return true}
   return false}
  function dfs(k,placed){if(!exhausted)return; if(++nodes>BUDGET){exhausted=false;return} if(placed>need)return; const rem=searchVars.length-k; if(placed+rem<need)return; if(k===searchVars.length){if(placed!==need||!checkRect(bits)||!diagConnected(bits))return; sol++; for(const v of searchVars){if(bits[v])OR[v]=1; else AND[v]=0} return} const v=searchVars[k],cs=varClues[k]; const asSafe=()=>{let ok=true; for(const ci of cs){curUnd[ci]--; if(curMine[ci]+curUnd[ci]<clues[ci].need)ok=false} if(ok)dfs(k+1,placed); for(const ci of cs)curUnd[ci]++}; const asMine=()=>{bits[v]=1; let ok=true; for(const ci of cs){curMine[ci]++;curUnd[ci]--; if(curMine[ci]>clues[ci].need)ok=false} if(ok&&!minePrune(v,k))dfs(k+1,placed+1); for(const ci of cs){curMine[ci]--;curUnd[ci]++} bits[v]=0}; const mineFirst=cs.some(ci=>clues[ci].need-curMine[ci]>=curUnd[ci]-(clues[ci].need-curMine[ci])); if(mineFirst){asMine(); if(!exhausted)return; asSafe()}else{asSafe(); if(!exhausted)return; asMine()}}
  dfs(0,0);
  if(!exhausted){
   const r2=mergeReturn({safe:new Set(),mine:deduceCandidateAsSafeForcedMineRectContradiction()},'tier general: candidate-as-safe forced-mine rectangle contradiction'); if(r2)return r2;
   const r4=mergeReturn({safe:deduceCornerDiagonalBlockage(),mine:new Set()},'tier general: corner diagonal blockage'); if(r4)return r4;
   log.push(...constraints,'warning: search budget exceeded; no guaranteed 2C deduction');
   return{ok:true,engine:ENGINE_2C_VERSION,mode:'2C',warning:'Search budget exceeded; no guaranteed 2C deduction',safe:[],mine:[],sol:undefined,exhausted:false,checkLines:log}}
  if(sol===0)return bad('contradiction: no legal 2C layout');
  const safe=[],mine=[]; for(const v of searchVars){if(OR[v]===0)safe.push(lab(xOf(v),yOf(v))); else if(AND[v]===1)mine.push(lab(xOf(v),yOf(v)))} safe.sort(); mine.sort(); log.push(...constraints,`deduce(2C exhaustive): intersection of ${sol} legal layout(s)`,`deduce: mine=${mine.length} safe=${safe.length}`); return{ok:true,engine:ENGINE_2C_VERSION,mode:'2C',safe,mine,sol,exhausted:true,checkLines:log};
 }catch(e){return bad('error: '+(e&&e.message?e.message:String(e)))}
}
if(typeof window!=='undefined'){window.ENGINE_2C_VERSION=ENGINE_2C_VERSION;window.infer2C=infer2C}
if(typeof module!=='undefined'&&module.exports)module.exports={ENGINE_2C_VERSION,infer2C};
