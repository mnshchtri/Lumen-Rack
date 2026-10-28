import './style.css';
import { FAM, OPS, PALS, PRESETS } from './ops.js';
import { NOISE, VS_QUAD, VS_PART, FS_PART, FS_IMG, FS_POST, FS_BLIT } from './shaders.js';
import { makeSample } from './sample.js';
import { createRecorder, saveBlob, stamp } from './recorder.js';
(() => {
const $ = s => document.querySelector(s);
const canvas = $('#gl');
const gl = canvas.getContext('webgl2', { antialias:false, alpha:false });
if (!gl) {
  const d = document.createElement('div'); d.className = 'nogl';
  d.textContent = 'This browser has no WebGL2, which the effects need. Try a recent Chrome, Edge, Firefox or Safari.';
  $('#vp').appendChild(d); return;
}

const S = {}; // state
function resetState(){
  OPS.forEach(op => { S[op.id] = { on:op.on }; op.params.forEach(p => S[op.id][p[0]] = p[5]); });
  S.ramp.pal = 0;
}
resetState();
if (matchMedia('(prefers-reduced-motion: reduce)').matches) S.particles.orbit = 0;

let activePreset = 'Particle bloom';
function applyPreset(name){
  resetState();
  const p = PRESETS[name];
  for (const id in p) Object.assign(S[id], p[id]);
  for (const id in S) S[id].on = !!S[id].on;
  activePreset = name; syncUI();
}
function randomize(){
  resetState();
  const r = (a,b) => a + Math.random()*(b-a);
  const usePart = Math.random() < .65;
  S.particles.on = usePart;
  if (usePart) Object.assign(S.particles, { density:Math.round(r(120,360)), size:r(1,4.5), turb:r(0,.9), explode:Math.random()<.35?r(.2,1):0, orbit:r(-.5,.5), depth:r(.2,1.2) });
  ['displace','kaleido','rgb','glitch','pixel','edge','ramp'].forEach(id => {
    S[id].on = Math.random() < (id==='ramp' ? .55 : .28);
    OPS.find(o=>o.id===id).params.forEach(p => { if (p[4] === 1) S[id][p[0]] = Math.round(r(p[2], p[3])); else S[id][p[0]] = r(p[2] + (p[3]-p[2])*.15, p[3]*.85); });
  });
  S.ramp.pal = Math.floor(Math.random()*PALS.length);
  S.feedback.on = Math.random() < .8;
  Object.assign(S.feedback, { amount:r(.5,.92), zoom:r(-1.2,1.4), rotate:Math.random()<.5?r(-1,1):0, hue:Math.random()<.3?r(.2,1.2):0 });
  activePreset = null; syncUI();
}

/* ---------- UI ---------- */
const fmt = (v, step, unit='') => (step >= 1 ? Math.round(v) : (+v).toFixed(2)) + unit;
const opsEl = $('#ops'), chainEl = $('#chain'), presetsEl = $('#presets');
const ui = {};

function buildUI(){
  Object.keys(PRESETS).forEach(n => {
    const b = document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=n; b.dataset.name=n;
    b.onclick = () => applyPreset(n); presetsEl.appendChild(b);
  });
  // chain
  const mk = (fam, name, cls) => { const b=document.createElement('button'); b.type='button'; b.className='node '+(cls||''); b.style.setProperty('--c', FAM[fam]);
    b.innerHTML = `<span class="fam"><i></i>${fam}</span><code>${name}</code>`; return b; };
  const wire = () => { const w=document.createElement('span'); w.className='wire'; return w; };
  const src = mk('TOP','moviefilein1','fixed'); src.setAttribute('aria-disabled','true'); chainEl.appendChild(src);
  OPS.forEach(op => {
    chainEl.appendChild(wire());
    const n = mk(op.fam, op.node); n.title = 'Toggle ' + op.label;
    n.onclick = () => { S[op.id].on = !S[op.id].on; activePreset=null; syncUI(); flash(op.id); };
    chainEl.appendChild(n); ui[op.id] = { node:n };
  });
  chainEl.appendChild(wire());
  const out = mk('TOP','out1','fixed'); out.setAttribute('aria-disabled','true'); chainEl.appendChild(out);

  // panel
  OPS.forEach(op => {
    const sec = document.createElement('section'); sec.className='op'; sec.id='op-'+op.id; sec.style.setProperty('--c', FAM[op.fam]);
    sec.innerHTML = `<header><span class="famtag">${op.fam}</span><h2>${op.label}<code>${op.node}</code></h2>
      <button class="sw" type="button" aria-label="Turn ${op.label} on or off"></button></header><p class="desc">${op.desc}</p><div class="params"></div>`;
    const sw = sec.querySelector('.sw');
    sw.onclick = () => { S[op.id].on = !S[op.id].on; activePreset=null; syncUI(); };
    const pe = sec.querySelector('.params'); const inputs = {};
    op.params.forEach(([k,label,min,max,step,def,unit]) => {
      const id = `p-${op.id}-${k}`;
      const l = document.createElement('label'); l.className='prm'; l.htmlFor=id;
      l.innerHTML = `<span>${label}</span><output></output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}">`;
      const inp = l.querySelector('input'), out = l.querySelector('output');
      inp.oninput = () => { S[op.id][k] = +inp.value; out.textContent = fmt(inp.value, step, unit); paint(inp); activePreset=null; markPresets();
        if (!S[op.id].on) { S[op.id].on = true; syncUI(); } };
      inputs[k] = { inp, out, step, unit }; pe.appendChild(l);
    });
    if (op.pals) {
      const pw = document.createElement('div'); pw.className='pals';
      PALS.forEach((p,i) => {
        const b = document.createElement('button'); b.type='button'; b.className='pal'; b.title=p.name; b.setAttribute('aria-label', p.name+' palette');
        const stops = [0,.25,.5,.75,1].map(t => { const c=[0,1,2].map(j => Math.round(255*(.5+.5*Math.cos(6.28318*(t+p.d[j]))))); return `rgb(${c})`; });
        b.style.background = `linear-gradient(90deg,${stops.join(',')})`;
        b.onclick = () => { S.ramp.pal=i; S.ramp.on=true; activePreset=null; syncUI(); };
        pw.appendChild(b);
      });
      sec.appendChild(pw); ui[op.id].pals = pw;
    }
    opsEl.appendChild(sec); Object.assign(ui[op.id], { sec, sw, inputs });
  });
}
function paint(inp){ const p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty('--p', p + '%'); }
function markPresets(){ presetsEl.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.name === activePreset)); }
function syncUI(){
  OPS.forEach(op => {
    const u = ui[op.id], on = S[op.id].on;
    u.node.setAttribute('aria-pressed', on); u.sw.setAttribute('aria-pressed', on); u.sec.classList.toggle('off', !on);
    for (const k in u.inputs) { const {inp,out,step,unit} = u.inputs[k]; inp.value = S[op.id][k]; out.textContent = fmt(S[op.id][k], step, unit); paint(inp); }
    if (u.pals) [...u.pals.children].forEach((b,i) => b.setAttribute('aria-pressed', i === S.ramp.pal));
  });
  markPresets();
}
function flash(id){ const s = ui[id].sec; s.classList.add('flash'); s.scrollIntoView({block:'nearest', behavior:'smooth'}); setTimeout(()=>s.classList.remove('flash'), 600); }
buildUI(); syncUI();

/* ---------- GL ---------- */
function sh(type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function prog(vs, fs){ const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  p.u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){ const info=gl.getActiveUniform(p,i); p.u[info.name]=gl.getUniformLocation(p,info.name); } return p; }
const P = { part:prog(VS_PART,FS_PART), img:prog(VS_QUAD,FS_IMG), post:prog(VS_QUAD,FS_POST), blit:prog(VS_QUAD,FS_BLIT) };
let cur;
const use = p => { cur=p; gl.useProgram(p); };
const f1 = (n,...v) => { const l=cur.u[n]; if(l==null) return; v.length===1?gl.uniform1f(l,v[0]):v.length===2?gl.uniform2f(l,v[0],v[1]):gl.uniform3f(l,v[0],v[1],v[2]); };
const i1 = (n,v) => { const l=cur.u[n]; if(l!=null) gl.uniform1i(l,v); };
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);

function tex(w,h){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  if(w) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null); return t; }
function fbo(w,h){ const t=tex(w,h), f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); return {f,t}; }
const delFbo = o => { if(o){ gl.deleteFramebuffer(o.f); gl.deleteTexture(o.t); } };

const srcTex = tex();
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
let srcW=1, srcH=1;
function upload(el, w, h){
  gl.bindTexture(gl.TEXTURE_2D,srcTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,el); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.generateMipmap(gl.TEXTURE_2D); srcW=w; srcH=h;
}

/* ---------- sources ---------- */
let video=null, objUrl=null, lastVT=-1;
const srcInfo=$('#srcInfo'), playBtn=$('#playBtn');
function stopVideo(){ if(video){ video.pause(); video.removeAttribute('src'); video.load(); video=null; } if(objUrl){ URL.revokeObjectURL(objUrl); objUrl=null; } playBtn.hidden=true; }
function loadSample(){ stopVideo(); const c=makeSample(); upload(c,c.width,c.height); srcInfo.textContent='sample · 1200×800'; }
function loadFile(file){
  if(!file) return;
  const isVid=file.type.startsWith('video/'), isImg=file.type.startsWith('image/');
  if(!isVid && !isImg){ srcInfo.textContent='That file is not a photo or video. Try JPG, PNG, WebP, MP4 or WebM.'; return; }
  stopVideo(); objUrl=URL.createObjectURL(file); const name=file.name.length>36?file.name.slice(0,33)+'…':file.name;
  if(isImg){
    const im=new Image();
    im.onload=()=>{ let w=im.naturalWidth,h=im.naturalHeight; const k=Math.min(1,2048/Math.max(w,h));
      let el=im; if(k<1){ const c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(h*k); c.getContext('2d').drawImage(im,0,0,c.width,c.height); el=c; }
      upload(el,el.width||w,el.height||h); srcInfo.textContent=`${name} · ${w}×${h}`; };
    im.onerror=()=>{ srcInfo.textContent='Could not read that image. Try a JPG or PNG.'; };
    im.src=objUrl;
  } else {
    const v=document.createElement('video'); v.muted=true; v.loop=true; v.playsInline=true; v.src=objUrl;
    v.onloadeddata=()=>{ video=v; lastVT=-1; srcInfo.textContent=`${name} · ${v.videoWidth}×${v.videoHeight} · video`; playBtn.hidden=false; setPlayIcon(); };
    v.onerror=()=>{ srcInfo.textContent='This browser cannot decode that video. Try MP4 (H.264) or WebM.'; };
    v.play().catch(()=>{});
  }
}
function setPlayIcon(){ const paused=video&&video.paused;
  playBtn.innerHTML = paused ? '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>' : '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>';
  playBtn.title = playBtn.ariaLabel = paused ? 'Play video' : 'Pause video'; }
playBtn.onclick=()=>{ if(!video) return; video.paused?video.play().catch(()=>{}):video.pause(); setPlayIcon(); };
$('#file').onchange=e=>{ loadFile(e.target.files[0]); e.target.value=''; };
$('#sample').onclick=loadSample;
$('#rand').onclick=randomize;
$('#fsBtn').onclick=()=>{ try{ document.fullscreenElement?document.exitFullscreen():$('#vp').requestFullscreen().catch(()=>{}); }catch(e){} };
const drop=$('#drop'); let dragDepth=0;
addEventListener('dragenter',e=>{ e.preventDefault(); dragDepth++; drop.hidden=false; });
addEventListener('dragleave',e=>{ dragDepth=Math.max(0,dragDepth-1); if(!dragDepth) drop.hidden=true; });
addEventListener('dragover',e=>e.preventDefault());
addEventListener('drop',e=>{ e.preventDefault(); dragDepth=0; drop.hidden=true; loadFile(e.dataTransfer.files[0]); });

/* ---------- pointer ---------- */
let mouse=[9,9], mTarget=0, mForce=0, down=false, aspect=1;
canvas.addEventListener('pointermove',e=>{ const r=canvas.getBoundingClientRect();
  mouse=[((e.clientX-r.left)/r.width*2-1)*aspect, -((e.clientY-r.top)/r.height*2-1)]; mTarget=down?2.2:1; $('#hint').hidden=true; });
canvas.addEventListener('pointerdown',e=>{ down=true; mTarget=2.2; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup',()=>{ down=false; mTarget=1; });
canvas.addEventListener('pointerleave',()=>{ if(!down) mTarget=0; });
canvas.addEventListener('pointercancel',()=>{ down=false; mTarget=0; });

/* ---------- loop ---------- */
let snapRequest=false;
$('#snap').onclick=()=>{ snapRequest=true; };
const recBtn=$('#rec');
const recorder=createRecorder(canvas,{ onChange:on=>{ recBtn.setAttribute('aria-pressed',on); recBtn.querySelector('span').textContent=on?'Stop':'Record'; } });
recBtn.onclick=()=>{ try{ recorder.toggle(); }catch(e){ srcInfo.textContent=e.message; } };
let W=0,H=0,scene=null,fb=[null,null],pi=0,dpr=1;
function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.max(2,Math.round(canvas.clientWidth*dpr)), h=Math.max(2,Math.round(canvas.clientHeight*dpr));
  if(w===W&&h===H) return; W=w; H=h; canvas.width=W; canvas.height=H; aspect=W/H;
  delFbo(scene); delFbo(fb[0]); delFbo(fb[1]); scene=fbo(W,H); fb=[fbo(W,H),fbo(W,H)];
}
let last=performance.now(), flowT=0, rot=0, spin=0, frames=0, fpsT=last, fps=0;
const stats=$('#stats');
function frame(now){
  const dt=Math.min(.05,(now-last)/1000); last=now; const t=now/1000;
  resize();
  if(video && video.readyState>=2 && video.currentTime!==lastVT){ lastVT=video.currentTime; upload(video,video.videoWidth,video.videoHeight); }
  const sa=srcW/srcH, s=Math.min(1,aspect/sa)*.92, fit=[sa*s,s];
  const pp=S.particles, tc=S.touch;
  flowT+=dt*pp.speed; rot+=dt*pp.orbit*.6; spin+=dt*S.kaleido.spin*.8;
  mForce+=((tc.on?mTarget:0)-mForce)*.12;

  gl.bindFramebuffer(gl.FRAMEBUFFER,scene.f); gl.viewport(0,0,W,H); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,srcTex);
  let count=0;
  if(pp.on){
    const cols=Math.round(pp.density), rows=Math.max(2,Math.round(cols/sa)); count=cols*rows;
    use(P.part); i1('uSrc',0); i1('uCols',cols); i1('uRows',rows); f1('uFit',...fit); f1('uMouse',...mouse);
    f1('uAspect',aspect); f1('uTime',flowT); f1('uNoise',pp.turb); f1('uExplode',pp.explode); f1('uDepth',pp.depth);
    f1('uSize',pp.size); f1('uRot',Math.sin(rot)*.9); f1('uMouseForce',mForce*tc.force); f1('uMouseRad',tc.radius);
    f1('uCut',pp.cutoff); f1('uDpr',dpr); f1('uGlow',pp.glow);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.drawArrays(gl.POINTS,0,count); gl.disable(gl.BLEND);
  } else {
    use(P.img); i1('uSrc',0); f1('uFit',...fit); f1('uMouse',...mouse); f1('uAspect',aspect); f1('uTime',t);
    f1('uMouseForce',mForce*tc.force); f1('uMouseRad',tc.radius); gl.drawArrays(gl.TRIANGLES,0,3);
  }

  const nxt=1-pi;
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb[nxt].f);
  use(P.post);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,scene.t); i1('uScene',0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,fb[pi].t); i1('uPrev',1);
  const on=(id,v)=>S[id].on?v:0, F=S.feedback, R=S.ramp;
  f1('uRes',W,H); f1('uTime',t); f1('uAspect',aspect);
  f1('uWarp',on('displace',S.displace.amount)); f1('uWarpScale',S.displace.scale);
  f1('uKSeg',on('kaleido',S.kaleido.segments)); f1('uKSpin',spin);
  f1('uRgb',on('rgb',S.rgb.amount)); f1('uGlitch',on('glitch',S.glitch.amount)); f1('uPixel',on('pixel',S.pixel.amount));
  f1('uEdge',on('edge',S.edge.amount)); f1('uRampMix',on('ramp',R.mix)); f1('uRampCycle',R.cycle); f1('uPd',...PALS[R.pal].d);
  f1('uFb',on('feedback',F.amount)); f1('uFbZoom',F.zoom); f1('uFbRot',F.rotate); f1('uFbHue',F.hue);
  gl.drawArrays(gl.TRIANGLES,0,3);

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  use(P.blit); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,fb[nxt].t); i1('uTex',0); f1('uTime',t);
  gl.drawArrays(gl.TRIANGLES,0,3);
  pi=nxt;
  if(snapRequest){ snapRequest=false; canvas.toBlob(b=>b&&saveBlob(b,`lumen-rack-${stamp()}.png`),'image/png'); }

  frames++; if(now-fpsT>500){ fps=Math.round(frames*1000/(now-fpsT)); frames=0; fpsT=now;
    stats.textContent=`${fps} fps · ${count?count.toLocaleString()+' pts · ':''}${W}×${H}`; }
  requestAnimationFrame(frame);
}
loadSample(); applyPreset('Particle bloom');
requestAnimationFrame(frame);
})();
