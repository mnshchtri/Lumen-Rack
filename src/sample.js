// Procedural sample image so the app opens with something to look at.
export function makeSample(){
  const W=1200,H=800,c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  let seed=7; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const sky=x.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#120c33'); sky.addColorStop(.45,'#5a2a6e'); sky.addColorStop(.72,'#d9536b'); sky.addColorStop(1,'#ffb35c');
  x.fillStyle=sky; x.fillRect(0,0,W,H);
  for(let i=0;i<260;i++){ const yy=rnd()*rnd()*H*.55; x.fillStyle=`rgba(255,255,255,${.3+rnd()*.7})`; x.fillRect(rnd()*W,yy,1.6,1.6); }
  const glow=x.createRadialGradient(760,470,20,760,470,360); glow.addColorStop(0,'rgba(255,228,170,.95)'); glow.addColorStop(.3,'rgba(255,170,110,.45)'); glow.addColorStop(1,'rgba(255,120,90,0)');
  x.fillStyle=glow; x.fillRect(0,0,W,H); x.fillStyle='#ffe6ad'; x.beginPath(); x.arc(760,470,92,0,7); x.fill();
  const layers=[['#7a2f63',420,170],['#4b2152',480,140],['#2c163c',560,110],['#130a1f',650,70]];
  layers.forEach(([col,base,amp],li)=>{ x.fillStyle=col; x.beginPath(); x.moveTo(0,H); let y=base;
    for(let px=0;px<=W;px+=12){ y+= (rnd()-.5)*amp*.35; y=Math.max(base-amp,Math.min(base+amp*.4,y)); x.lineTo(px,y); }
    x.lineTo(W,H); x.closePath(); x.fill();
    if(li===0){ x.globalAlpha=.25; x.fillStyle='#fff'; x.fill(); x.globalAlpha=1; } });
  return c;
}
