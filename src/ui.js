// DOM for the library, network, inspector, toasts and help.
import { OPMAP, FAM, PALS, PRESETS, MOD_SOURCES } from './ops.js';

const P = {
  undo: '<path d="M5 3 2 6l3 3"/><path d="M2 6h8a4 4 0 0 1 0 8H7"/>',
  redo: '<path d="m11 3 3 3-3 3"/><path d="M14 6H6a4 4 0 0 0 0 8h3"/>',
  compare: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M8 2v12"/><path d="M8 3h4.5A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5H8z" fill="currentColor" stroke="none" opacity=".35"/>',
  dice: '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><circle cx="5.7" cy="5.7" r=".6" fill="currentColor"/><circle cx="10.3" cy="10.3" r=".6" fill="currentColor"/><circle cx="8" cy="8" r=".6" fill="currentColor"/><circle cx="10.3" cy="5.7" r=".6" fill="currentColor"/><circle cx="5.7" cy="10.3" r=".6" fill="currentColor"/>',
  link: '<path d="m6.5 9.5 3-3"/><path d="m7 4.5 1-1a3 3 0 0 1 4.2 4.2l-1 1"/><path d="m9 11.5-1 1a3 3 0 0 1-4.2-4.2l1-1"/>',
  camera: '<path d="M2 5.5h2.5L6 3.5h4l1.5 2H14v7H2z"/><circle cx="8" cy="9" r="2.3"/>',
  keyboard: '<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M4 6.8h.01M6.5 6.8h.01M9 6.8h.01M11.5 6.8h.01M5 9.4h6"/>',
  expand: '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/>',
  upload: '<path d="M8 11V2.5M4.5 6 8 2.5 11.5 6"/><path d="M2.5 10.5v3h11v-3"/>',
  webcam: '<circle cx="8" cy="7" r="4.5"/><circle cx="8" cy="7" r="1.5"/><path d="M5 14h6"/>',
  mic: '<rect x="5.5" y="1.5" width="5" height="8" rx="2.5"/><path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2"/>',
  music: '<path d="M6 12V3.2l7-1.5v8.8"/><circle cx="4.3" cy="12" r="1.8"/><circle cx="11.3" cy="10.5" r="1.8"/>',
  wave: '<path d="M1.5 8c1.3-4 2.7-4 4 0s2.7 4 4 0 2.7-4 5 0"/>',
  power: '<path d="M8 1.8v5.4"/><path d="M4.6 4.2a5 5 0 1 0 6.8 0"/>',
  close: '<path d="m4 4 8 8M12 4l-8 8"/>',
  play: '<path d="M5 3.2v9.6L13 8z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="4" y="3" width="3" height="10" rx=".6" fill="currentColor" stroke="none"/><rect x="9" y="3" width="3" height="10" rx=".6" fill="currentColor" stroke="none"/>',
  reset: '<path d="M2.6 8a5.4 5.4 0 1 0 1.7-3.9"/><path d="M2.6 2.6v3h3"/>',
  left: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
  right: '<path d="M6 3.5 10.5 8 6 12.5"/>',
};
export const icon = n => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (el.dataset.iconDone) return;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    el.dataset.iconDone = '1';
  });
}

export const fmt = (p, v) => {
  if (p.type === 'enum') return p.options[v];
  if (p.type === 'palette') return PALS[v].name;
  const s = p.step >= 1 ? String(Math.round(v)) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  return s + (p.unit || '');
};
export const paint = inp => inp.style.setProperty('--p', ((inp.value - inp.min) / (inp.max - inp.min)) * 100 + '%');
export const palCss = d => `linear-gradient(90deg, ${[0, .25, .5, .75, 1].map(t =>
  `rgb(${[0, 1, 2].map(j => Math.round(255 * (.5 + .5 * Math.cos(6.28318 * (t + d[j])))))})`).join(', ')})`;
const pct = (p, v) => ((v - p.min) / (p.max - p.min)) * 100;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createUI(app) {
  const $ = s => document.querySelector(s);
  const insp = $('#insp'), net = $('#net');
  let live = [], nodeVals = {};

  /* ---------- toasts ---------- */
  function toast(msg, err = false) {
    const box = $('#toasts');
    const t = el('div', 'toast' + (err ? ' err' : ''));
    t.textContent = msg; box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.remove(), err ? 4500 : 2200);
  }

  /* ---------- network ---------- */
  function summary(op) {
    const e = app.E[op.id];
    const p = op.params.find(x => x.type === 'range') || op.params[0];
    if (!p || !e) return '';
    return p.type === 'range' ? `${p.k} ${fmt(p, e[p.k])}` : fmt(p, e[p.k]);
  }
  function renderNetwork() {
    net.innerHTML = ''; nodeVals = {};
    ['source', 'particles', 'touch', ...app.state.order, 'out'].forEach((id, i) => {
      if (i) net.appendChild(el('span', 'wire'));
      net.appendChild(makeNode(id));
    });
    net.querySelectorAll('.wire').forEach(w => w.classList.toggle('on', !w.nextElementSibling.classList.contains('off')));
  }
  function makeNode(id) {
    const isSrc = id === 'source';
    const op = isSrc ? { id, node: 'moviefilein1', fam: 'TOP', label: 'Source', params: [] } : OPMAP[id];
    const on = isSrc || op.always || app.state.ops[id].on;
    const canBypass = !isSrc && !op.always;
    const n = el('div', `node${op.stage === 'post' ? ' post' : ''}${on ? '' : ' off'}${app.selected === id ? ' sel' : ''}`);
    n.dataset.id = id; n.tabIndex = 0; n.setAttribute('role', 'button');
    n.setAttribute('aria-label', `${op.label}${on ? '' : ', bypassed'}${app.selected === id ? ', selected' : ''}`);
    n.style.setProperty('--c', FAM[op.fam]);
    n.innerHTML = `<div class="node-top"><i class="dot"></i><span class="fam">${op.fam}</span>${canBypass
      ? `<button class="pwr" type="button" aria-pressed="${on}" title="${on ? 'Bypass' : 'Enable'} (B)" aria-label="${on ? 'Bypass' : 'Enable'} ${op.label}">${icon('power')}</button>` : ''}</div>
      <code class="nname">${op.node}</code><span class="nval"></span>`;
    const val = n.querySelector('.nval');
    if (isSrc) val.textContent = app.sources?.cur?.kind || '';
    else { nodeVals[id] = val; val.textContent = summary(op); }
    if (canBypass) n.querySelector('.pwr').addEventListener('click', e => { e.stopPropagation(); app.toggleOp(id); });
    n.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(id); }
      else if (e.altKey && op.stage === 'post' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); app.moveBy(id, e.key === 'ArrowLeft' ? -1 : 1); }
    });
    attachDrag(n, id, op);
    return n;
  }
  function select(id) { if (id === 'source') app.focusSource(); else app.select(id); }
  function attachDrag(n, id, op) {
    let sx = 0, pid = null, dragging = false, marker = null, idx = 0, posts = [];
    n.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.pwr')) return;
      sx = e.clientX; pid = e.pointerId; dragging = false;
    });
    n.addEventListener('pointermove', e => {
      if (pid !== e.pointerId) return;
      const dx = e.clientX - sx;
      if (!dragging) {
        if (op.stage !== 'post' || Math.abs(dx) < 6) return;
        dragging = true; n.setPointerCapture(pid); n.classList.add('drag');
        marker = el('span', 'drop-mark'); net.appendChild(marker);
        posts = [...net.querySelectorAll('.node.post')].filter(x => x !== n);
      }
      n.style.transform = `translateX(${dx}px)`;
      const x = e.clientX;
      idx = posts.filter(o => { const r = o.getBoundingClientRect(); return r.left + r.width / 2 < x; }).length;
      const rowL = net.getBoundingClientRect().left;
      const mx = idx < posts.length ? posts[idx].getBoundingClientRect().left - 11 : posts[posts.length - 1].getBoundingClientRect().right + 11;
      marker.style.left = (mx - rowL) + 'px';
      const sc = net.parentElement, sr = sc.getBoundingClientRect();
      if (x < sr.left + 40) sc.scrollLeft -= 10; else if (x > sr.right - 40) sc.scrollLeft += 10;
    });
    const end = e => {
      if (pid !== e.pointerId) return;
      pid = null;
      if (dragging) { dragging = false; n.classList.remove('drag'); n.style.transform = ''; marker?.remove(); app.moveTo(id, idx); }
      else if (e.type === 'pointerup') select(id);
    };
    n.addEventListener('pointerup', end);
    n.addEventListener('pointercancel', end);
  }
  function focusNode(id) { net.querySelector(`[data-id="${id}"]`)?.focus(); }

  /* ---------- inspector ---------- */
  function renderInspector() {
    const keep = insp.scrollTop;
    live = [];
    const op = OPMAP[app.selected], st = app.state.ops[op.id], i = app.state.order.indexOf(op.id);
    insp.style.setProperty('--c', FAM[op.fam]);
    insp.classList.toggle('off', !st.on && !op.always);
    insp.innerHTML = `<div class="insp-head">
      <div class="insp-title"><h2>${op.label}</h2>${op.always ? '' : `<button class="switch" type="button" aria-pressed="${st.on}" aria-label="${op.label} on" title="On or bypassed (B)"></button>`}</div>
      <div class="insp-sub"><span class="famtag">${op.fam}</span><code>${op.node}</code>${op.stage === 'post' ? `<span>· step ${i + 1} of ${app.state.order.length}</span>` : ''}</div>
      <p class="insp-desc">${op.desc}</p>
      <div class="insp-tools">
        <button class="tb sm" type="button" data-act="reset" data-icon="reset"><span>Reset</span></button>
        ${op.stage === 'post' ? `<button class="tb sm" type="button" data-act="left" data-icon="left" title="Move earlier (Alt+←)" ${i <= 0 ? 'disabled' : ''}><span>Earlier</span></button>
        <button class="tb sm" type="button" data-act="right" data-icon="right" title="Move later (Alt+→)" ${i >= app.state.order.length - 1 ? 'disabled' : ''}><span>Later</span></button>` : ''}
      </div></div><div class="insp-body"></div>`;
    const body = insp.querySelector('.insp-body');
    if (!st.on && !op.always) {
      const note = el('div', 'insp-off-note', '<span>Bypassed. Moving a slider turns it on.</span><button class="link" type="button">Turn on</button>');
      note.querySelector('button').onclick = () => app.toggleOp(op.id);
      body.appendChild(note);
    }
    for (const p of op.params) body.appendChild(p.type === 'range' ? rangeRow(op, p) : p.type === 'enum' ? enumRow(op, p) : palRow(op, p));
    hydrateIcons(insp);
    insp.querySelector('.switch')?.addEventListener('click', () => app.toggleOp(op.id));
    insp.querySelector('[data-act=reset]').onclick = () => app.resetOp(op.id);
    insp.querySelector('[data-act=left]')?.addEventListener('click', () => app.moveBy(op.id, -1));
    insp.querySelector('[data-act=right]')?.addEventListener('click', () => app.moveBy(op.id, 1));
    insp.scrollTop = keep;
  }
  function touched(opId) {
    if (app.state.ops[opId].on || OPMAP[opId].always) return;
    app.state.ops[opId].on = true;
    insp.classList.remove('off');
    insp.querySelector('.switch')?.setAttribute('aria-pressed', 'true');
    insp.querySelector('.insp-off-note')?.remove();
    renderNetwork();
  }
  function rangeRow(op, p) {
    const key = `${op.id}.${p.k}`, id = `p-${op.id}-${p.k}`, m = app.state.mods[key], v = app.state.ops[op.id][p.k];
    const row = el('div', 'prm' + (m ? ' modded' : ''));
    row.innerHTML = `<div class="prm-head"><label for="${id}">${p.label}</label>
      <button class="mod-btn" type="button" aria-pressed="${!!m}" title="${m ? 'Stop animating' : 'Animate with an LFO or audio'}" aria-label="Animate ${p.label}">${icon('wave')}</button>
      <output for="${id}"></output></div>
      <div class="track"><input type="range" id="${id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" title="Double-click to reset">${m ? '<span class="live"></span>' : ''}</div>`;
    const inp = row.querySelector('input'), out = row.querySelector('output');
    out.textContent = fmt(p, v); paint(inp);
    inp.addEventListener('input', () => { touched(op.id); app.setParam(op.id, p.k, +inp.value); if (!m) out.textContent = fmt(p, +inp.value); paint(inp); });
    inp.addEventListener('change', () => app.commit());
    inp.addEventListener('dblclick', () => { inp.value = p.def; app.setParam(op.id, p.k, p.def); out.textContent = fmt(p, p.def); paint(inp); app.commit(); });
    row.querySelector('.mod-btn').addEventListener('click', () => app.setMod(key, m ? null : { src: 'lfo', rate: .25, depth: .25 }));
    if (m) { row.appendChild(modBox(key, m)); live.push({ p, opId: op.id, liveEl: row.querySelector('.live'), out }); }
    return row;
  }
  function modBox(key, m) {
    const box = el('div', 'modbox');
    const seg = el('div', 'seg sm'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Modulation source');
    MOD_SOURCES.forEach(([v, l]) => {
      const b = el('button'); b.type = 'button'; b.textContent = l; b.setAttribute('aria-pressed', m.src === v);
      b.onclick = () => app.setMod(key, { ...m, src: v }); seg.appendChild(b);
    });
    box.appendChild(seg);
    const row = (label, k, min, max, step, f) => {
      const r = el('label', 'modrow', `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${m[k]}"><output></output>`);
      const i = r.querySelector('input'), o = r.querySelector('output');
      o.textContent = f(m[k]); paint(i);
      i.oninput = () => { m[k] = +i.value; app.updateMod(key, m); o.textContent = f(m[k]); paint(i); };
      i.onchange = () => app.commit();
      box.appendChild(r);
    };
    if (m.src === 'lfo') row('Rate', 'rate', .02, 4, .01, v => v.toFixed(2) + ' Hz');
    row('Depth', 'depth', -1, 1, .01, v => (v > 0 ? '+' : '') + Math.round(v * 100) + '%');
    if (m.src !== 'lfo' && app.audio.kind === 'off') box.appendChild(el('p', 'note', 'No audio yet. Turn on Mic or load a Song in the library.'));
    return box;
  }
  function enumRow(op, p) {
    const row = el('div', 'prm', `<div class="prm-head"><span class="plabel">${p.label}</span></div>`);
    const seg = el('div', 'seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', p.label);
    p.options.forEach((o, i) => {
      const b = el('button'); b.type = 'button'; b.textContent = o; b.setAttribute('aria-pressed', app.state.ops[op.id][p.k] === i);
      b.onclick = () => {
        touched(op.id); app.setParam(op.id, p.k, i); app.commit();
        seg.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', j === i));
      };
      seg.appendChild(b);
    });
    row.appendChild(seg);
    return row;
  }
  function palRow(op, p) {
    const row = el('div', 'prm', `<div class="prm-head"><span class="plabel">${p.label}</span><output></output></div>`);
    const out = row.querySelector('output'); out.textContent = PALS[app.state.ops[op.id][p.k]].name;
    const g = el('div', 'pals');
    PALS.forEach((pal, i) => {
      const b = el('button', 'pal'); b.type = 'button'; b.title = pal.name; b.setAttribute('aria-label', pal.name + ' palette');
      b.style.background = palCss(pal.d); b.setAttribute('aria-pressed', app.state.ops[op.id][p.k] === i);
      b.onclick = () => {
        touched(op.id); app.setParam(op.id, p.k, i); app.commit(); out.textContent = pal.name;
        g.querySelectorAll('.pal').forEach((x, j) => x.setAttribute('aria-pressed', j === i));
      };
      g.appendChild(b);
    });
    row.appendChild(g);
    return row;
  }

  /* ---------- library ---------- */
  function renderPresets() {
    const ul = $('#presetList'); ul.innerHTML = '';
    const add = (pr, i, user) => {
      const li = el('li', 'preset-li');
      const b = el('button', 'preset', `<span class="sw"></span><span class="pname"></span><span class="pkey">${!user && i < 9 ? i + 1 : ''}</span>`);
      b.type = 'button'; b.setAttribute('aria-pressed', app.activePreset === pr.name);
      b.querySelector('.sw').style.background = `linear-gradient(135deg, ${pr.sw[0]}, ${pr.sw[1]})`;
      b.querySelector('.pname').textContent = pr.name;
      b.onclick = () => app.applyPreset(pr);
      li.appendChild(b);
      if (user) {
        const d = el('button', 'preset-del', icon('close')); d.type = 'button';
        d.title = 'Delete preset'; d.setAttribute('aria-label', `Delete ${pr.name}`);
        d.onclick = () => app.deletePreset(i);
        li.appendChild(d);
      }
      ul.appendChild(li);
    };
    PRESETS.forEach((p, i) => add(p, i, false));
    if (app.userPresets.length) {
      ul.appendChild(el('li', 'preset-sep', 'Your presets'));
      app.userPresets.forEach((p, i) => add(p, i, true));
    }
  }
  function renderSource(cur) {
    const kinds = { sample: 'Sample', photo: 'Photo', video: 'Video', camera: 'Live' };
    $('#srcKind').textContent = kinds[cur.kind];
    $('#srcName').textContent = cur.name;
    $('#srcName').title = cur.name;
    $('#srcMeta').textContent = `${cur.origW || cur.w} × ${cur.origH || cur.h}${cur.kind === 'video' && cur.el.duration ? ' · ' + fmtTime(cur.el.duration) : ''}`;
    $('#srcPill').textContent = cur.name;
    $('#vctl').hidden = cur.kind !== 'video';
    $('#camera').setAttribute('aria-pressed', cur.kind === 'camera');
    if (cur.kind === 'video') { $('#vScrub').max = cur.el.duration || 1; setPlayIcon(); }
    drawThumb();
    renderAudio();
    const srcNode = net.querySelector('[data-id="source"] .nval'); if (srcNode) srcNode.textContent = cur.kind;
  }
  function setPlayIcon() {
    const v = app.sources.cur?.el, b = $('#vPlay'); if (!v || !b) return;
    b.innerHTML = icon(v.paused ? 'play' : 'pause');
    b.setAttribute('aria-label', v.paused ? 'Play video' : 'Pause video');
  }
  function drawThumb() {
    const cur = app.sources.cur; if (!cur) return;
    const c = $('#thumb'), x = c.getContext('2d');
    const s = Math.max(c.width / cur.w, c.height / cur.h), w = cur.w * s, h = cur.h * s;
    x.fillStyle = '#0c0c10'; x.fillRect(0, 0, c.width, c.height);
    try { x.drawImage(cur.el, (c.width - w) / 2, (c.height - h) / 2, w, h); } catch { /* frame not ready */ }
  }
  function renderAudio() {
    const a = app.audio, isVid = app.sources.cur?.kind === 'video';
    $('#audioKind').textContent = a.kind === 'off' ? 'Off' : a.kind === 'song' ? 'Song' : a.kind === 'mic' ? 'Mic' : 'Video';
    $('#audioKind').title = a.label;
    $('#mic').setAttribute('aria-pressed', a.kind === 'mic');
    $('#song').setAttribute('aria-pressed', a.kind === 'song');
    $('#vidAudio').hidden = !isVid;
    $('#vidAudio').setAttribute('aria-pressed', a.kind === 'video');
    $('#audioStop').hidden = a.kind === 'off';
  }

  /* ---------- per-frame ---------- */
  const meters = [...document.querySelectorAll('.meter')].map(m => ({ band: m.dataset.band, bar: m.querySelector('i') }));
  let lastRec = '';
  function tick(n) {
    const b = app.audio.bands;
    for (const m of meters) m.bar.style.transform = `scaleX(${b[m.band].toFixed(3)})`;
    for (const r of live) {
      const v = app.E[r.opId][r.p.k];
      r.liveEl.style.setProperty('--live', pct(r.p, v) + '%');
      r.out.textContent = fmt(r.p, v);
    }
    if (n % 4 === 0) for (const id in nodeVals) {
      const op = OPMAP[id]; nodeVals[id].textContent = summary(op);
      nodeVals[id].classList.toggle('live', Object.keys(app.state.mods).some(k => k.startsWith(id + '.')));
    }
    if (n % 10 === 0) {
      const v = app.sources.cur?.kind === 'video' ? app.sources.cur.el : null;
      if (v && document.activeElement !== $('#vScrub')) { $('#vScrub').value = v.currentTime; paint($('#vScrub')); $('#vTime').textContent = fmtTime(v.currentTime); }
      if (app.recorder.recording) {
        const s = fmtTime(app.recorder.elapsed);
        if (s !== lastRec) { $('#rec span').textContent = s; lastRec = s; }
      }
    }
  }
  function setRecording(on) {
    const b = $('#rec'); b.setAttribute('aria-pressed', on);
    b.querySelector('span').textContent = on ? '0:00' : 'Record';
    b.title = on ? 'Stop recording (V)' : 'Record video (V)';
    lastRec = '';
  }

  /* ---------- help ---------- */
  function renderHelp() {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const C = mac ? '⌘' : 'Ctrl';
    const rows = [
      ['Upload a photo, video or song', ['U']], ['Play or pause the video', ['Space']], ['Randomize', ['R']],
      ['Built-in presets', ['1', '–', '9']], ['Save a snapshot', ['S']], ['Start or stop recording', ['V']],
      ['Hold to compare with the original', ['\\']], ['Undo', [C, 'Z']], ['Redo', [C, 'Shift', 'Z']],
      ['Previous or next node', ['[', ']']], ['Bypass the selected node', ['B']], ['Move an effect earlier or later', ['Alt', '←', '→']],
      ['Hide or show panels', ['H']], ['Fullscreen', ['F']], ['Reset a slider', ['Double-click']],
    ];
    $('#keys').innerHTML = rows.map(([d, ks]) => `<dt>${d}</dt><dd>${ks.map(k => k === '–' ? '<span>–</span>' : `<kbd>${k}</kbd>`).join('')}</dd>`).join('');
  }

  function renderAll() {
    renderNetwork(); renderInspector(); renderPresets(); renderAudio();
  }

  return { renderAll, renderNetwork, renderInspector, renderPresets, renderSource, renderAudio, renderHelp, drawThumb, setPlayIcon, tick, toast, setRecording, focusNode };
}
