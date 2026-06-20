'use strict';
const ENGINE_Q_VERSION='engine-q v002';
function inferQ(io){
  const log=[ENGINE_Q_VERSION];
  const bad=msg=>({ok:false,engine:ENGINE_Q_VERSION,checkLines:[ENGINE_Q_VERSION,msg],mine:[],safe:[],sol:0,exhausted:true});
  try{
    const n=io&&(io.size|0), K=io&&(io.mines|0);
    if(n<5||n>8)return bad(`unsupported size=${n}; Quad supports 5..8`);
    if(!io||!Array.isArray(io.board)||io.board.length<n)return bad('invalid io.board');
    if(K<0||K>n*n)return bad(`invalid mines=${K}`);
    const R=1<<n,N=n*n,T=N+1;
    const id=(x,y)=>y*n+x, lab=(x,y)=>String.fromCharCode(65+x)+String(y+1), xy=i=>[i%n,(i/n)|0];
    const pc=new Uint8Array(R); for(let m=1;m<R;m++)pc[m]=pc[m>>1]+(m&1);
    const fixed=new Int8Array(N).fill(-1), isN=new Uint8Array(N), val=new Int16Array(N).fill(-1), vars=[];
    function cell(c){
      if(c==null)return{t:'e'}; if(typeof c==='number')return{t:'n',v:c|0};
      if(typeof c==='string'){const s=c.trim(); if(s==='.'||s===''||s.toLowerCase()==='e')return{t:'e'}; if(s==='?'||s.toLowerCase()==='q')return{t:'q'}; if(s.toUpperCase()==='F'||s.toLowerCase()==='f')return{t:'f'}; if(/^-?[0-9]+$/.test(s))return{t:'n',v:parseInt(s,10)|0}; return{t:'e'};}
      const t=String(c.t||c.kind||'').toLowerCase();
      if(t==='e'||t==='empty')return{t:'e'}; if(t==='q'||t==='?')return{t:'q'}; if(t==='f'||t==='flag')return{t:'f'};
      if(t==='n'||t==='num'||t==='number')return{t:'n',v:Math.trunc(Number(c.v??c.value??0))}; return{t:'e'};
    }
    for(let y=0;y<n;y++){
      if(!Array.isArray(io.board[y])||io.board[y].length<n)return bad(`invalid board row ${y+1}`);
      for(let x=0;x<n;x++){
        const c=cell(io.board[y][x]), i=id(x,y);
        if(c.t==='f')fixed[i]=1; else if(c.t==='q')fixed[i]=0; else if(c.t==='n'){if(c.v<0||c.v>8)return bad(`invalid number ${lab(x,y)}=${c.v|0}`); fixed[i]=0; isN[i]=1; val[i]=c.v|0;} else vars.push(i);
      }
    }
    let fcnt=0; for(let i=0;i<N;i++)if(fixed[i]===1)fcnt++;
    if(fcnt>K)return bad(`contradiction: flags=${fcnt} exceed mines=${K}`);
    if(fcnt+vars.length<K)return bad(`contradiction: flags+unknown=${fcnt+vars.length} < mines=${K}`);
    const rows=[],lo=[],hi=[];
    for(let y=0;y<n;y++){
      let one=0,zero=0; const a=[];
      for(let x=0;x<n;x++){const f=fixed[id(x,y)]; if(f===1)one|=1<<x; else if(f===0)zero|=1<<x;}
      let mn=99,mx=-1; for(let m=0;m<R;m++){if((m&one)!==one||(m&zero)!==0)continue; a.push(m); if(pc[m]<mn)mn=pc[m]; if(pc[m]>mx)mx=pc[m];}
      if(!a.length)return bad(`contradiction: row ${y+1} has no legal masks`); rows[y]=a; lo[y]=mn; hi[y]=mx;
    }
    const smin=Array(n+1).fill(0),smax=Array(n+1).fill(0); for(let y=n-1;y>=0;y--){smin[y]=smin[y+1]+lo[y]; smax[y]=smax[y+1]+hi[y];}
    const clues=Array.from({length:n},()=>[]); let clueCnt=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=id(x,y); if(isN[i]){clues[y].push({x,y,v:val[i]|0}); clueCnt++;}}
    const bit=(m,y)=>BigInt(m)<<BigInt(y*n), has=(m,x)=>((m>>x)&1)!==0;
    function cnt(x,y,u,m,d){let c=0; for(let dy=-1;dy<=1;dy++){const yy=y+dy; if(yy<0||yy>=n)continue; const mask=dy<0?u:dy>0?d:m; for(let dx=-1;dx<=1;dx++){if(dx===0&&dy===0)continue; const xx=x+dx; if(xx>=0&&xx<n&&has(mask,xx))c++;}} return c;}
    function clueOK(y,u,m,d){for(const c of clues[y])if(cnt(c.x,c.y,u,m,d)!==c.v)return false; return true;}
    function quad(a,b){for(let x=0;x<n-1;x++)if((((a|b)>>x)&3)===0)return false; return true;}
    for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const a=fixed[id(x,y)],b=fixed[id(x+1,y)],c=fixed[id(x,y+1)],d=fixed[id(x+1,y+1)]; if(a===0&&b===0&&c===0&&d===0)return bad(`contradiction: fixed-safe 2x2 at ${lab(x,y)}-${lab(x+1,y+1)} violates Quad`);}
    const next=Array.from({length:n},()=>Array.from({length:R},()=>[]));
    for(let y=1;y<n;y++)for(let p=0;p<R;p++)for(const m of rows[y])if(quad(p,m))next[y][p].push(m);
    const cache=Array.from({length:n},()=>new Map()), key=(pp,p)=>((pp+1)<<n)|p;
    function cand(y,pp,p){const k=key(pp,p),mp=cache[y]; if(mp.has(k))return mp.get(k); const src=next[y][p], r=y-1, u=pp>=0?pp:0; let out=src; if(clues[r].length){out=[]; for(const m of src)if(clueOK(r,u,p,m))out.push(m);} mp.set(k,out); return out;}
    const enc=(pp,p,t)=>(((pp+1)*R+p)*T+t);
    let states=new Map();
    for(const m of rows[0]){const t=pc[m]; if(t+smin[1]>K||t+smax[1]<K)continue; const b=bit(m,0); states.set(m*T+t,{pp:-1,p:m,t,c:1n,o:b,a:b});}
    if(!states.size)return bad('contradiction: no legal first row');
    let trans=0,peak=states.size;
    for(let y=1;y<n;y++){
      const ns=new Map();
      for(const st of states.values())for(const m of cand(y,st.pp,st.p)){
        trans++; const t=st.t+pc[m]; if(t+smin[y+1]>K||t+smax[y+1]<K)continue;
        const b=bit(m,y), o=st.o|b, a=st.a|b, pp=clues[y].length?st.p:-1, k=enc(pp,m,t), old=ns.get(k);
        if(old){old.c+=st.c; old.o|=o; old.a&=a;} else ns.set(k,{pp,p:m,t,c:st.c,o,a});
      }
      states=ns; if(states.size>peak)peak=states.size; if(!states.size)return bad(`contradiction: no legal states after row ${y+1}`);
    }
    let sol=0n, OR=0n, AND=null;
    for(const st of states.values())if(st.t===K&&clueOK(n-1,n>=2?st.pp:0,st.p,0)){sol+=st.c; OR|=st.o; AND=AND===null?st.a:(AND&st.a);}
    if(sol===0n)return bad('contradiction: no legal solutions');
    const mine=[],safe=[]; for(const i of vars){const b=1n<<BigInt(i),p=xy(i); if((AND&b)!==0n)mine.push(lab(p[0],p[1])); else if((OR&b)===0n)safe.push(lab(p[0],p[1]));}
    log.push('Quad: every 2x2 block has at least one mine','OK exact row-mask DP',`solutions=${sol.toString()}`,`states=${states.size} peak=${peak} transitions=${trans}`,`clues=${clueCnt} unknown=${vars.length}`,`deduce: mine=${mine.length} safe=${safe.length}`);
    return{ok:true,engine:ENGINE_Q_VERSION,checkLines:log,mine,safe,sol:sol<=BigInt(Number.MAX_SAFE_INTEGER)?Number(sol):sol.toString(),exhausted:true};
  }catch(e){return bad('error: '+(e&&e.message?e.message:String(e)));}
}
function installQuadEngineInfoPatch(){
  if(typeof window==='undefined'||typeof document==='undefined')return;
  function patch(){
    const el=document.getElementById('fileInfo'); if(!el)return;
    const modeSel=document.getElementById('modeSel'), mode=modeSel?modeSel.value:'';
    const loaded=[]; if(typeof window.ENGINE_2G_VERSION!=='undefined')loaded.push(window.ENGINE_2G_VERSION); if(typeof window.ENGINE_Q_VERSION!=='undefined')loaded.push(window.ENGINE_Q_VERSION); if(typeof window.ENGINE_2C_VERSION!=='undefined')loaded.push(window.ENGINE_2C_VERSION);
    let active='—'; if(mode==='q')active=window.ENGINE_Q_VERSION||'engine-q.js not loaded'; else if(mode==='2g')active=window.ENGINE_2G_VERSION||'engine-2g.js not loaded'; else if(mode==='2c')active=window.ENGINE_2C_VERSION||'engine-2c.js not loaded'; else if(mode==='w')active='no W engine'; else active='no Normal engine';
    const next=`Active Engine: ${active} | Loaded: ${loaded.length?loaded.join(' | '):'—'} | App: ${document.title||'Solgic3'}`;
    if(el.textContent!==next)el.textContent=next;
  }
  function bind(){
    const el=document.getElementById('fileInfo'), modeSel=document.getElementById('modeSel'); if(!el)return false;
    let busy=false; new MutationObserver(()=>{if(busy)return; busy=true; setTimeout(()=>{patch(); busy=false;},0);}).observe(el,{childList:true,characterData:true,subtree:true});
    if(modeSel)modeSel.addEventListener('change',()=>setTimeout(patch,0)); patch(); return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind(); setTimeout(patch,0);}); else if(!bind())setTimeout(()=>{bind(); setTimeout(patch,0);},0);
}
if(typeof window!=='undefined'){window.ENGINE_Q_VERSION=ENGINE_Q_VERSION; window.inferQ=inferQ; installQuadEngineInfoPatch();}
if(typeof module!=='undefined'&&module.exports)module.exports={ENGINE_Q_VERSION,inferQ};
