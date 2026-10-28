import './style.css';
import { OPS, OPMAP, PALS, PRESETS, DEFAULT_ORDER } from './ops.js';
import { Renderer } from './renderer.js';
import { Sources } from './sources.js';
import { AudioEngine } from './audio.js';
import { createRecorder, saveBlob, stamp } from './recorder.js';
import { defaultState, sanitize, fromPartial, encodeState, decodeState, History, store, clone } from './state.js';
import { createUI, hydrateIcons } from './ui.js';

const $ = s => document.querySelector(s);
const KEY = 'lumen-rack:v2', PKEY = 'lumen-rack:presets', OKEY = 'lumen-rack:onboarded';
const canvas = $('#gl');
hydrateIcons();

let renderer = null;
try { renderer = new Renderer(canvas); } catch (e) { console.error(e); $('#nogl').hidden = false; }
if (renderer) start();

function start() {
  /* ---------- state ---------- */
  const app = {
    state: null, E: {}, selected: 'particles', activePreset: null,
    userPresets: store.get(PKEY, []),
    audio: new AudioEngine(), sources: null, recorder: null,
  };
  let shared = false;
  const hash = new URLSearchParams(location.hash.slice(1)).get('s');
  if (hash) {
    const s = decodeState(hash);
    if (s) { app.state = s; shared = true; }
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (!app.state) {
    const saved = store.get(KEY);
    app.state = saved ? sanitize(saved) : fromPartial(PRESETS[0].s);
    if (!saved) app.activePreset = PRESETS[0].name;
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && !store.get(KEY)) app.state.ops.particles.orbit = 0;

  const hist = new History();
  let saveTimer;
  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set(KEY, app.state), 400); };
  const refreshUndo = () => { $('#undo').disabled = !hist.canUndo; $('#redo').disabled = !hist.canRedo; };
  const clearPreset = () => { if (app.activePreset) { app.activePreset = null; ui.renderPresets(); } };

  evaluate(0);
  const ui = createUI(app);

  Object.assign(app, {
    commit() { hist.push(app.state); persist(); refreshUndo(); },
    setParam(id, k, v) { app.state.ops[id][k] = v; clearPreset(); },
    toggleOp(id) {
      if (OPMAP[id].always) return;
      app.state.ops[id].on = !app.state.ops[id].on; clearPreset(); app.commit();
      ui.renderNetwork(); if (app.selected === id) ui.renderInspector();
    },
    select(id) { app.selected = id; ui.renderNetwork(); ui.renderInspector(); ui.focusNode(id); },
    moveTo(id, index) {
      const o = app.state.order.filter(x => x !== id);
      o.splice(Math.max(0, Math.min(o.length, index)), 0, id);
      if (o.join() !== app.state.order.join()) { app.state.order = o; clearPreset(); app.commit(); }
      app.selected = id; ui.renderNetwork(); ui.renderInspector(); ui.focusNode(id);
    },
    moveBy(id, d) { app.moveTo(id, app.state.order.indexOf(id) + d); },
    setMod(key, m) {
      if (m) app.state.mods[key] = m; else delete app.state.mods[key];
      const id = key.split('.')[0];
      if (m && !OPMAP[id].always) app.state.ops[id].on = true;
      clearPreset(); app.commit(); ui.renderInspector(); ui.renderNetwork();
    },
    updateMod(key, m) { app.state.mods[key] = m; clearPreset(); },
    resetOp(id) {
      const on = app.state.ops[id].on;
      app.state.ops[id] = { ...defaultState().ops[id], on };
      for (const k in app.state.mods) if (k.startsWith(id + '.')) delete app.state.mods[k];
      clearPreset(); app.commit(); ui.renderInspector(); ui.renderNetwork();
    },
    applyPreset(pr) {
      app.state = fromPartial(pr.s); app.activePreset = pr.name; app.commit(); ui.renderAll();
      ui.toast(pr.name);
    },
    savePreset(name) {
      const h = Math.floor(Math.random() * 360);
      const r = app.state.ops.ramp;
      const sw = r.on ? [0.85, 0.2].map(t => { const d = PALS[r.palette].d; return `rgb(${d.map(x => Math.round(255 * (.5 + .5 * Math.cos(6.28318 * (t + x)))))})`; })
        : [`hsl(${h} 90% 64%)`, `hsl(${(h + 80) % 360} 60% 30%)`];
      app.userPresets.push({ name, sw, s: clone(app.state) });
      store.set(PKEY, app.userPresets);
      app.activePreset = name; ui.renderPresets(); ui.toast(`Saved “${name}”`);
    },
    deletePreset(i) {
      const [p] = app.userPresets.splice(i, 1); store.set(PKEY, app.userPresets);
      if (app.activePreset === p.name) app.activePreset = null;
      ui.renderPresets(); ui.toast(`Deleted “${p.name}”`);
    },
    undo() { const s = hist.undo(); if (s) restore(s); },
    redo() { const s = hist.redo(); if (s) restore(s); },
    focusSource() {
      const card = $('#srcCard'); card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      $('#upload').focus();
    },
  });
  function restore(s) { app.state = sanitize(s); app.activePreset = null; persist(); ui.renderAll(); refreshUndo(); }

  /* ---------- modulation ---------- */
  function evaluate(t) {
    for (const op of OPS) {
      const e = app.E[op.id] || (app.E[op.id] = {});
      const so = app.state.ops[op.id];
      e.on = op.always ? true : so.on;
      for (const p of op.params) {
        let v = so[p.k];
        if (p.type === 'range') {
          const m = app.state.mods[op.id + '.' + p.k];
          if (m) {
            const sig = m.src === 'lfo' ? Math.sin(t * m.rate * Math.PI * 2) : app.audio.bands[m.src];
            v = Math.min(p.max, Math.max(p.min, v + m.depth * (p.max - p.min) * sig));
            if (p.step >= 1) v = Math.round(v);
          }
        }
        e[p.k] = v;
      }
    }
  }

  /* ---------- sources ---------- */
  app.sources = new Sources(renderer, {
    onChange(cur) {
      if (app.audio.kind === 'video') app.audio.detach();
      ui.renderSource(cur);
      if (cur.kind !== 'sample') dismissOnboard();
    },
    onError: msg => ui.toast(msg, true),
  });

  function loadFile(file) {
    if (!file) return;
    const t = file.type || '';
    if (t.startsWith('image/')) app.sources.image(file);
    else if (t.startsWith('video/')) app.sources.videoFile(file);
    else if (t.startsWith('audio/')) loadSong(file);
    else ui.toast('That file type isn’t supported. Use a photo, video or audio file.', true);
  }
  async function loadSong(file) {
    try { await app.audio.useSong(file); ui.toast(`Playing “${file.name}”`); dismissOnboard(); }
    catch { ui.toast('That audio file could not be played. Try MP3, M4A or WAV.', true); app.audio.detach(); }
    ui.renderAudio();
  }
  const fileInput = $('#file');
  fileInput.onchange = e => { loadFile(e.target.files[0]); e.target.value = ''; };
  $('#songFile').onchange = e => { loadSong(e.target.files[0]); e.target.value = ''; };
  $('#upload').onclick = () => fileInput.click();
  $('#camera').onclick = () => app.sources.camera();
  $('#sample').onclick = () => app.sources.sample();

  $('#vPlay').onclick = togglePlay;
  $('#vScrub').oninput = e => { const v = app.sources.cur?.el; if (v) v.currentTime = +e.target.value; };
  function togglePlay() {
    const cur = app.sources.cur;
    if (cur?.kind === 'video') { cur.el.paused ? cur.el.play().catch(() => {}) : cur.el.pause(); ui.setPlayIcon(); }
    else if (app.audio.kind === 'song' && app.audio.songEl) { const s = app.audio.songEl; s.paused ? s.play() : s.pause(); }
  }

  /* ---------- audio ---------- */
  $('#mic').onclick = async () => {
    if (app.audio.kind === 'mic') { app.audio.detach(); ui.renderAudio(); return; }
    try { await app.audio.useMic(); ui.toast('Listening to your microphone'); }
    catch { ui.toast('Microphone access was blocked. Allow it in your browser’s site settings, then try again.', true); }
    ui.renderAudio();
  };
  $('#song').onclick = () => $('#songFile').click();
  $('#vidAudio').onclick = () => {
    const v = app.sources.cur?.el; if (!v) return;
    if (app.audio.kind === 'video') { app.audio.detach(); v.muted = true; }
    else { v.muted = false; app.audio.useElement(v, 'Video sound', 'video'); v.play().catch(() => {}); ui.setPlayIcon(); }
    ui.renderAudio();
  };
  $('#audioStop').onclick = () => {
    if (app.audio.kind === 'video' && app.sources.cur?.el) app.sources.cur.el.muted = true;
    app.audio.detach(); ui.renderAudio();
  };

  /* ---------- presets ---------- */
  $('#savePresetBtn').onclick = () => { const f = $('#saveForm'); f.hidden = !f.hidden; if (!f.hidden) $('#presetName').focus(); };
  $('#saveForm').onsubmit = e => {
    e.preventDefault();
    const name = $('#presetName').value.trim() || `Look ${app.userPresets.length + 1}`;
    app.savePreset(name); $('#presetName').value = ''; $('#saveForm').hidden = true;
  };
  $('#presetName').onkeydown = e => { if (e.key === 'Escape') $('#saveForm').hidden = true; };

  /* ---------- randomize ---------- */
  function randomize() {
    const s = defaultState(), r = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
    const rand = p => {
      if (p.type === 'enum') return Math.floor(Math.random() * p.options.length);
      if (p.type === 'palette') return Math.floor(Math.random() * PALS.length);
      const v = r(p.min + (p.max - p.min) * .1, p.max - (p.max - p.min) * .15);
      return p.step >= 1 ? Math.round(v) : v;
    };
    const P = s.ops.particles;
    P.on = Math.random() < .6;
    if (P.on) Object.assign(P, {
      density: Math.round(r(120, 360)), size: r(1, 4.5), shape: pick([0, 0, 1, 2]), turb: r(0, .9), depth: r(.2, 1.2),
      explode: Math.random() < .3 ? r(.2, 1) : 0, scatter: Math.random() < .3 ? r(.1, .6) : 0, orbit: r(-.5, .5),
    });
    const post = DEFAULT_ORDER.filter(id => id !== 'feedback' && id !== 'bloom');
    for (const id of post) {
      s.ops[id].on = Math.random() < (id === 'ramp' ? .5 : .22);
      for (const p of OPMAP[id].params) s.ops[id][p.k] = rand(p);
    }
    s.ops.halftone.mix = 1; s.ops.edge.amount = r(.7, 1);
    if (!P.on && !post.some(id => s.ops[id].on)) s.ops[pick(['kaleido', 'edge', 'halftone', 'glitch', 'mirror'])].on = true;
    Object.assign(s.ops.feedback, {
      on: Math.random() < .75, blend: Math.random() < .7 ? 0 : pick([1, 2]), amount: r(.5, .92),
      zoom: r(-1.2, 1.4), rotate: Math.random() < .5 ? r(-1, 1) : 0, hue: Math.random() < .3 ? r(.2, 1.2) : 0,
    });
    Object.assign(s.ops.bloom, { on: Math.random() < .7, amount: r(.2, .8) });
    if (Math.random() < .4) {
      const i = Math.floor(Math.random() * s.order.length), j = Math.floor(Math.random() * s.order.length);
      [s.order[i], s.order[j]] = [s.order[j], s.order[i]];
    }
    const cands = OPS.filter(o => s.ops[o.id].on && o.stage !== 'out').flatMap(o => o.params.filter(p => p.type === 'range' && !p.acc).map(p => `${o.id}.${p.k}`));
    if (cands.length && Math.random() < .55) for (let n = 0; n < 1 + Math.floor(Math.random() * 2); n++) {
      s.mods[pick(cands)] = { src: Math.random() < .6 ? 'lfo' : pick(['bass', 'level']), rate: r(.05, .6), depth: r(.1, .35) * (Math.random() < .5 ? -1 : 1) };
    }
    app.state = sanitize(s); app.activePreset = null; app.commit(); ui.renderAll();
    ui.toast('Randomized. Press Ctrl+Z to undo.');
  }

  /* ---------- export ---------- */
  let snapReq = false;
  app.recorder = createRecorder(canvas, {
    audioTracks: () => app.audio.recordTracks,
    onChange: on => ui.setRecording(on),
    onSaved: name => ui.toast(`Saved ${name}`),
  });
  const snap = () => { snapReq = true; };
  const toggleRec = () => { try { app.recorder.toggle(); } catch (e) { ui.toast(e.message, true); } };
  $('#snap').onclick = snap;
  $('#rec').onclick = toggleRec;
  $('#share').onclick = async () => {
    const url = `${location.origin}${location.pathname}#s=${encodeState(app.state)}`;
    try { await navigator.clipboard.writeText(url); ui.toast('Link copied. Anyone with it sees this look.'); }
    catch { history.replaceState(null, '', '#s=' + encodeState(app.state)); ui.toast('Copy the link from the address bar.'); }
  };

  /* ---------- toolbar ---------- */
  $('#rand').onclick = randomize;
  $('#undo').onclick = () => app.undo();
  $('#redo').onclick = () => app.redo();
  let compare = false;
  const setCompare = on => { compare = on; $('#origPill').hidden = !on; $('#compare').setAttribute('aria-pressed', on); };
  const cmp = $('#compare');
  cmp.addEventListener('pointerdown', e => { cmp.setPointerCapture(e.pointerId); setCompare(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => cmp.addEventListener(t, () => setCompare(false)));
  cmp.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCompare(true); } });
  cmp.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') setCompare(false); });

  const appEl = $('#app');
  function toggleImmersive() {
    const on = appEl.classList.toggle('immersive');
    $('#exitImm').hidden = !on;
    if (!on) $('#immersive').focus();
  }
  $('#immersive').onclick = toggleImmersive;
  $('#exitImm').onclick = toggleImmersive;
  const fullscreen = () => {
    try { document.fullscreenElement ? document.exitFullscreen() : $('#vp').requestFullscreen().catch(() => {}); }
    catch { ui.toast('Fullscreen isn’t available here.', true); }
  };
  canvas.addEventListener('dblclick', fullscreen);

  const modal = $('#helpModal');
  const openHelp = () => { ui.renderHelp(); modal.hidden = false; modal.querySelector('[data-close]').focus(); };
  const closeHelp = () => { modal.hidden = true; $('#help').focus(); };
  $('#help').onclick = openHelp;
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) closeHelp(); });

  /* ---------- onboarding ---------- */
  const onboard = $('#onboard');
  if (!store.get(OKEY)) onboard.hidden = false;
  function dismissOnboard() { if (!onboard.hidden) { onboard.hidden = true; store.set(OKEY, true); } }
  onboard.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'upload') fileInput.click();
    if (a === 'camera') app.sources.camera();
    if (a) dismissOnboard();
  });

  /* ---------- drag & drop ---------- */
  const drop = $('#drop'); let depth = 0;
  addEventListener('dragenter', e => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); depth++; drop.hidden = false; });
  addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.hidden = true; });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); depth = 0; drop.hidden = true; loadFile(e.dataTransfer.files[0]); });

  /* ---------- pointer ---------- */
  let mouse = [9, 9], mTarget = 0, mForce = 0, down = false;
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), aspect = r.width / r.height;
    mouse = [((e.clientX - r.left) / r.width * 2 - 1) * aspect, -((e.clientY - r.top) / r.height * 2 - 1)];
    mTarget = down ? 2.2 : 1;
  });
  canvas.addEventListener('pointerdown', e => { down = true; mTarget = 2.2; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { down = false; mTarget = 1; });
  canvas.addEventListener('pointerleave', () => { if (!down) mTarget = 0; });
  canvas.addEventListener('pointercancel', () => { down = false; mTarget = 0; });

  /* ---------- keyboard ---------- */
  const typing = t => (t.tagName === 'INPUT' && t.type !== 'range') || t.tagName === 'TEXTAREA' || t.isContentEditable;
  const seq = () => ['particles', 'touch', ...app.state.order, 'out'];
  addEventListener('keydown', e => {
    if (typing(e.target)) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? app.redo() : app.undo(); return; }
    if (mod && k.toLowerCase() === 'y') { e.preventDefault(); app.redo(); return; }
    if (mod || e.altKey) return;
    if (!modal.hidden) { if (k === 'Escape') closeHelp(); return; }
    switch (k.length === 1 ? k.toLowerCase() : k) {
      case ' ': if (e.target.closest('button, [role=button]')) return; e.preventDefault(); togglePlay(); break;
      case 'r': randomize(); break;
      case 's': snap(); break;
      case 'v': toggleRec(); break;
      case 'u': fileInput.click(); break;
      case 'f': fullscreen(); break;
      case 'h': toggleImmersive(); break;
      case 'b': app.toggleOp(app.selected); break;
      case '[': case ']': { const q = seq(), i = q.indexOf(app.selected); app.select(q[Math.max(0, Math.min(q.length - 1, i + (k === '[' ? -1 : 1)))]); break; }
      case '?': openHelp(); break;
      case '\\': if (!e.repeat) setCompare(true); break;
      case 'Escape': if (appEl.classList.contains('immersive')) toggleImmersive(); else $('#saveForm').hidden = true; break;
      default: if (/^[1-9]$/.test(k) && PRESETS[+k - 1]) app.applyPreset(PRESETS[+k - 1]);
    }
  });
  addEventListener('keyup', e => { if (e.key === '\\') setCompare(false); });

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ui.toast('The graphics driver reset. Reload the page to continue.', true); });

  /* ---------- loop ---------- */
  const acc = {};
  for (const op of OPS) for (const p of op.params) if (p.acc) (acc[op.id] ||= {})[p.k] = 0;
  let last = performance.now(), flowT = 0, rot = 0, frames = 0, fpsT = last, n = 0;
  let autoScale = 1, low = 0, high = 0;
  const stats = $('#stats');

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; n++;
    const t = now / 1000;
    app.audio.update(dt);
    evaluate(t);
    const E = app.E, q = E.out.quality;
    const scale = q === 0 ? autoScale : [1, 1, .75, .5][q];
    const dpr = Math.min(devicePixelRatio || 1, 2) * scale;
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    renderer.resize(w, h);
    app.sources.tick();

    flowT += dt * E.particles.speed;
    rot += dt * E.particles.orbit * .6;
    for (const id in acc) for (const k in acc[id]) acc[id][k] += dt * E[id][k] * (id === 'kaleido' ? .8 : 1);
    mForce += ((E.touch.on ? mTarget : 0) - mForce) * Math.min(1, dt * 8);

    const count = renderer.render({ E, order: app.state.order, acc, mouse, mouseForce: mForce, time: t, flowT, rot, dpr, compare });

    if (snapReq) {
      snapReq = false;
      canvas.toBlob(b => { if (b) { const name = `lumen-rack-${stamp()}.png`; saveBlob(b, name); ui.toast(`Saved ${name}`); } }, 'image/png');
    }

    frames++;
    if (now - fpsT >= 500) {
      const fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now;
      stats.textContent = `${Math.round(fps)} fps · ${count ? count.toLocaleString() + ' pts · ' : ''}${w}×${h}${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}`;
      if (q === 0 && !document.hidden) {
        if (fps < 42) { high = 0; if ((low += .5) >= 1.5 && autoScale > .5) { autoScale = Math.max(.5, autoScale - .15); low = 0; } }
        else if (fps > 57) { low = 0; if ((high += .5) >= 4 && autoScale < 1) { autoScale = Math.min(1, autoScale + .1); high = 0; } }
        else low = high = 0;
      }
    }
    const kind = app.sources.cur?.kind;
    if ((kind === 'video' || kind === 'camera') && n % 30 === 0) ui.drawThumb();
    ui.tick(n);
    requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  app.sources.sample();
  ui.renderAll();
  hist.push(app.state); refreshUndo();
  if (shared) ui.toast('Loaded a shared look');
  requestAnimationFrame(frame);
}
