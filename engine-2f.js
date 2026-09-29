'use strict';
const ENGINE_2F_VERSION = 'engine-2f v002';

function infer2F(io){
  const bad = msg => ({ok:false, engine:ENGINE_2F_VERSION, mode:'2F', checkLines:[ENGINE_2F_VERSION,msg], mine:[], safe:[], proofs:{}, exhausted:true});
  try{
    const n = io && (io.size|0), K = io && (io.mines|0);
    if(n < 5 || n > 8) return bad(`unsupported size=${n}; 2F supports 5..8`);
    if(!io || !Array.isArray(io.board) || io.board.length < n) return bad('invalid io.board');
    if(K < 0 || K > n*n) return bad(`invalid mines=${K}`);

    const N=n*n;
    const id=(x,y)=>y*n+x, xOf=i=>i%n, yOf=i=>(i/n)|0;
    const lab=i=>String.fromCharCode(65+xOf(i))+String(yOf(i)+1);
    const D8=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    const D4=[[0,-1],[-1,0],[1,0],[0,1]];
    const neigh=(i,dirs)=>{const x=xOf(i),y=yOf(i),a=[]; for(const [dx,dy] of dirs){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<n&&yy<n)a.push(id(xx,yy));} return a;};
    const N8=Array.from({length:N},(_,i)=>neigh(i,D8));
    const N4=Array.from({length:N},(_,i)=>neigh(i,D4));
    const colored=i=>((xOf(i)+yOf(i))&1)===1; // A1 uncolored, B1 colored

    function norm(c){
      if(c==null) return {t:'e'};
      if(typeof c==='number') return {t:'n',v:c|0};
      if(typeof c==='string'){
        const s=c.trim();
        if(s===''||s==='.'||s.toLowerCase()==='e') return {t:'e'};
        if(s==='?'||s.toLowerCase()==='q') return {t:'q'};
        if(s.toUpperCase()==='F') return {t:'f'};
        if(/^\d+$/.test(s)) return {t:'n',v:parseInt(s,10)|0};
        return {t:'e'};
      }
      const t=String(c.t||c.kind||'').toLowerCase();
      if(t==='e'||t==='empty') return {t:'e'};
      if(t==='q'||t==='?') return {t:'q'};
      if(t==='f'||t==='flag') return {t:'f'};
      if(t==='n'||t==='num'||t==='number') return {t:'n',v:Math.trunc(Number(c.v??c.value??0))};
      return {t:'e'};
    }

    const base=new Int8Array(N).fill(-1);
    const isNum=new Uint8Array(N);
    const numVal=new Int16Array(N).fill(-1);
    const vars=[];
    for(let y=0;y<n;y++){
      if(!Array.isArray(io.board[y])||io.board[y].length<n) return bad(`invalid board row ${y+1}`);
      for(let x=0;x<n;x++){
        const i=id(x,y),c=norm(io.board[y][x]);
        if(c.t==='f') base[i]=1;
        else if(c.t==='q') base[i]=0;
        else if(c.t==='n'){
          if(c.v<0||c.v>8) return bad(`invalid number ${lab(i)}=${c.v}`);
          base[i]=0; isNum[i]=1; numVal[i]=c.v;
        } else vars.push(i);
      }
    }

    function closure(initial, seedTrace){
      const a=new Int8Array(initial);
      const trace=seedTrace ? seedTrace.slice() : [];
      let contradiction=null, changed=true;
      const assign=(i,v,why)=>{
        if(a[i]===v) return false;
        if(a[i]!==-1){ contradiction=`${lab(i)} forced both ${a[i]===1?'mine':'safe'} and ${v===1?'mine':'safe'} (${why})`; return false; }
        a[i]=v; trace.push(`${lab(i)} = ${v===1?'mine':'safe'} :: ${why}`); return true;
      };

      while(changed && !contradiction){
        changed=false;

        let m=0,u=0;
        for(let i=0;i<N;i++){if(a[i]===1)m++; else if(a[i]===-1)u++;}
        if(m>K){contradiction=`mine count ${m} exceeds total ${K}`; break;}
        if(m+u<K){contradiction=`only ${m+u} possible mines remain, below total ${K}`; break;}
        if(u){
          if(m===K){
            for(let i=0;i<N;i++) if(a[i]===-1){
              if(assign(i,0,`total mines already ${K}`)) changed=true;
              if(contradiction) break;
            }
          } else if(m+u===K){
            for(let i=0;i<N;i++) if(a[i]===-1){
              if(assign(i,1,`all ${u} remaining cells must fill total ${K}`)) changed=true;
              if(contradiction) break;
            }
          }
        }
        if(contradiction) break;

        const cons=[];
        for(let i=0;i<N;i++){
          if(!isNum[i]) continue;
          let fm=0; const cells=[];
          for(const j of N8[i]){if(a[j]===1)fm++; else if(a[j]===-1)cells.push(j);}
          const need=numVal[i]-fm;
          if(need<0||need>cells.length){
            contradiction=`clue ${lab(i)}=${numVal[i]} cannot be satisfied (fixed mines=${fm}, unknown=${cells.length})`;
            break;
          }
          cons.push({cells:[...new Set(cells)].sort((x,y)=>x-y),need,why:`clue ${lab(i)}=${numVal[i]}`});
        }
        if(contradiction) break;

        {
          let fm=0; const cells=[];
          for(let i=0;i<N;i++){if(a[i]===1)fm++; else if(a[i]===-1)cells.push(i);}
          const need=K-fm;
          if(need<0||need>cells.length){contradiction=`total mines=${K} cannot be satisfied (fixed=${fm}, unknown=${cells.length})`;break;}
          cons.push({cells,need,why:`total mines=${K}`});
        }

        for(let i=0;i<N;i++){
          if(!colored(i)||a[i]!==1) continue;
          let fm=0; const cells=[];
          for(const j of N4[i]){if(a[j]===1)fm++; else if(a[j]===-1)cells.push(j);}
          const need=1-fm;
          if(need<0||need>cells.length){
            contradiction=`2F at colored mine ${lab(i)} cannot have exactly one orthogonal mine (fixed=${fm}, unknown=${cells.length})`;
            break;
          }
          cons.push({cells:[...new Set(cells)].sort((x,y)=>x-y),need,why:`2F colored mine ${lab(i)}`});
        }
        if(contradiction) break;

        for(const c of cons){
          if(!c.cells.length){
            if(c.need!==0){contradiction=`${c.why} has no variables but still needs ${c.need} mine(s)`;break;}
            continue;
          }
          if(c.need===0){
            for(const j of c.cells){
              if(assign(j,0,`${c.why}: remaining mine count is 0`)) changed=true;
              if(contradiction) break;
            }
          } else if(c.need===c.cells.length){
            for(const j of c.cells){
              if(assign(j,1,`${c.why}: every remaining variable must be a mine`)) changed=true;
              if(contradiction) break;
            }
          }
          if(contradiction) break;
        }
        if(contradiction||changed) continue;

        const isSubset=(small,bigSet)=>small.every(v=>bigSet.has(v));
        outer: for(let p=0;p<cons.length;p++) for(let q=0;q<cons.length;q++){
          if(p===q) continue;
          const A=cons[p],B=cons[q];
          if(!A.cells.length||A.cells.length>B.cells.length) continue;
          const bs=new Set(B.cells);
          if(!isSubset(A.cells,bs)) continue;
          const as=new Set(A.cells);
          const diff=B.cells.filter(v=>!as.has(v));
          const need=B.need-A.need;
          if(need<0||need>diff.length){
            contradiction=`constraint contradiction: (${B.why}) - (${A.why}) needs ${need} mines in ${diff.length} cells`;
            break outer;
          }
          if(!diff.length){
            if(need!==0){contradiction=`constraint contradiction between ${A.why} and ${B.why}`;break outer;}
            continue;
          }
          if(need===0){
            for(const j of diff){
              if(assign(j,0,`constraint difference: (${B.why}) - (${A.why}) = 0 mines`)) changed=true;
              if(contradiction) break;
            }
            if(changed||contradiction) break outer;
          } else if(need===diff.length){
            for(const j of diff){
              if(assign(j,1,`constraint difference: (${B.why}) - (${A.why}) fills all ${diff.length} cells`)) changed=true;
              if(contradiction) break;
            }
            if(changed||contradiction) break outer;
          }
        }
      }
      return {a,trace,contradiction};
    }

    const MAX_NESTED_SPLIT_DEPTH=1; // one extra case split inside a candidate assumption
    const MAX_PROOF_PROBES=12000;
    let proofProbes=0, budgetExhausted=false;

    function proveContradiction(initial, depth, seedTrace){
      if(proofProbes++ >= MAX_PROOF_PROBES){budgetExhausted=true; return {proved:false};}
      const c=closure(initial,seedTrace);
      if(c.contradiction){
        return {proved:true, proof:{kind:'direct', contradiction:c.contradiction, steps:c.trace}};
      }
      if(depth<=0) return {proved:false};

      const unresolved=vars.filter(i=>c.a[i]===-1);
      for(const pivot of unresolved){
        if(budgetExhausted) break;
        const mineSeed=new Int8Array(c.a); mineSeed[pivot]=1;
        const pm=proveContradiction(mineSeed,depth-1,c.trace.concat(`CASE ${lab(pivot)} = mine`));
        if(!pm.proved) continue;
        const safeSeed=new Int8Array(c.a); safeSeed[pivot]=0;
        const ps=proveContradiction(safeSeed,depth-1,c.trace.concat(`CASE ${lab(pivot)} = safe`));
        if(ps.proved){
          return {proved:true, proof:{kind:'split', pivot:lab(pivot), mine:pm.proof, safe:ps.proof}};
        }
      }
      return {proved:false};
    }

    const start=closure(base,[]);
    if(start.contradiction) return bad(`contradiction: ${start.contradiction}`);

    const mine=new Set(), safe=new Set(), proofs={};

    for(const i of vars){
      if(base[i]===-1 && start.a[i]!==-1){
        (start.a[i]===1?mine:safe).add(i);
        proofs[lab(i)]={type:'propagation', conclusion:start.a[i]===1?'mine':'safe', steps:start.trace.slice()};
      }
    }

    for(const i of vars){
      if(start.a[i]!==-1) continue;

      const mineSeed=new Int8Array(base); mineSeed[i]=1;
      const mineTry=proveContradiction(mineSeed,MAX_NESTED_SPLIT_DEPTH,[`ASSUME ${lab(i)} = mine`]);
      const safeSeed=new Int8Array(base); safeSeed[i]=0;
      const safeTry=proveContradiction(safeSeed,MAX_NESTED_SPLIT_DEPTH,[`ASSUME ${lab(i)} = safe`]);

      if(mineTry.proved && safeTry.proved){
        return bad(`input contradiction: both ${lab(i)}=mine and ${lab(i)}=safe can be refuted`);
      }
      if(mineTry.proved){
        safe.add(i);
        proofs[lab(i)]={type:'nested-contradiction', conclusion:'safe', assumption:'mine', proof:mineTry.proof};
      } else if(safeTry.proved){
        mine.add(i);
        proofs[lab(i)]={type:'nested-contradiction', conclusion:'mine', assumption:'safe', proof:safeTry.proof};
      }
    }

    for(const i of safe) if(mine.has(i)) return bad(`internal contradiction: ${lab(i)} proved both safe and mine`);

    const mineLabels=[...mine].map(lab).sort();
    const safeLabels=[...safe].map(lab).sort();
    const checkLines=[
      ENGINE_2F_VERSION,
      '2F: checkerboard coloring, A1 uncolored / B1 colored',
      '2F: a mine on a colored cell has exactly one orthogonal mine',
      'proof engine: fixed-point propagation + exact-sum subset algebra + nested contradiction (one extra case split)',
      'each candidate is proved from the original board; same-call outputs are not reused',
      'no brute-force completion enumeration',
      `proof probes=${proofProbes}/${MAX_PROOF_PROBES}${budgetExhausted?' (budget reached)':''}`,
      `deduce: mine=${mineLabels.length} safe=${safeLabels.length}`
    ];

    return {ok:true,engine:ENGINE_2F_VERSION,mode:'2F',mine:mineLabels,safe:safeLabels,proofs,exhausted:!budgetExhausted,checkLines};
  }catch(e){
    return bad('error: '+(e&&e.message?e.message:String(e)));
  }
}

if(typeof window!=='undefined'){
  window.ENGINE_2F_VERSION=ENGINE_2F_VERSION;
  window.infer2F=infer2F;
}
if(typeof module!=='undefined'&&module.exports){
  module.exports={ENGINE_2F_VERSION,infer2F};
}
