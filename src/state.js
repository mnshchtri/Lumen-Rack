// Patch state: defaults, validation, share-link encoding, undo history.
import { OPS, OPMAP, PALS, DEFAULT_ORDER, MOD_SOURCES } from './ops.js';

export const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SRC = MOD_SOURCES.map(s => s[0]);

export function defaultState() {
  const ops = {};
  for (const op of OPS) {
    const o = { on: !!op.on };
    for (const p of op.params) o[p.k] = p.def;
    ops[op.id] = o;
  }
  return { ops, order: DEFAULT_ORDER.slice(), mods: {} };
}

export function clampParam(p, v) {
  if (p.type === 'enum') return clamp(Math.round(v), 0, p.options.length - 1);
  if (p.type === 'palette') return clamp(Math.round(v), 0, PALS.length - 1);
  v = clamp(v, p.min, p.max);
  return p.step >= 1 ? Math.round(v) : v;
}

/** Turns anything (old saves, share links, partial presets) into a complete, valid state. */
export function sanitize(raw) {
  const s = defaultState();
  if (!raw || typeof raw !== 'object') return s;
  if (raw.ops && typeof raw.ops === 'object') {
    for (const op of OPS) {
      const r = raw.ops[op.id]; if (!r || typeof r !== 'object') continue;
      if ('on' in r) s.ops[op.id].on = !!r.on;
      for (const p of op.params) {
        const v = r[p.k];
        if (typeof v === 'number' && Number.isFinite(v)) s.ops[op.id][p.k] = clampParam(p, v);
      }
      if (op.always) s.ops[op.id].on = true;
    }
  }
  if (Array.isArray(raw.order)) {
    const seen = [...new Set(raw.order.filter(id => DEFAULT_ORDER.includes(id)))];
    s.order = [...seen, ...DEFAULT_ORDER.filter(id => !seen.includes(id))];
  }
  if (raw.mods && typeof raw.mods === 'object') {
    for (const key in raw.mods) {
      const [id, k] = key.split('.');
      const p = OPMAP[id]?.params.find(x => x.k === k && x.type === 'range');
      const m = raw.mods[key];
      if (!p || !m) continue;
      s.mods[key] = {
        src: SRC.includes(m.src) ? m.src : 'lfo',
        rate: clamp(Number(m.rate) || .25, .02, 4),
        depth: clamp(Number(m.depth) || 0, -1, 1),
      };
    }
  }
  return s;
}

/** Builds a full state from a preset's partial description on top of defaults. */
export function fromPartial(partial = {}) {
  const s = defaultState();
  for (const id in partial.ops || {}) Object.assign(s.ops[id], partial.ops[id]);
  if (partial.order) s.order = partial.order;
  if (partial.mods) s.mods = clone(partial.mods);
  return sanitize(s);
}

const round = v => Math.round(v * 1000) / 1000;
function compact(s) {
  const ops = {};
  for (const id in s.ops) {
    const o = {};
    for (const k in s.ops[id]) o[k] = typeof s.ops[id][k] === 'number' ? round(s.ops[id][k]) : (s.ops[id][k] ? 1 : 0);
    ops[id] = o;
  }
  return { v: 2, ops, order: s.order, mods: s.mods };
}
export function encodeState(s) {
  const json = JSON.stringify(compact(s));
  const bytes = new TextEncoder().encode(json);
  let bin = ''; bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeState(str) {
  try {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    return sanitize(JSON.parse(json));
  } catch { return null; }
}

export class History {
  constructor(limit = 100) { this.stack = []; this.i = -1; this.limit = limit; }
  push(state) {
    const snap = JSON.stringify(state);
    if (this.stack[this.i] === snap) return;
    this.stack = this.stack.slice(0, this.i + 1);
    this.stack.push(snap);
    if (this.stack.length > this.limit) this.stack.shift();
    this.i = this.stack.length - 1;
  }
  get canUndo() { return this.i > 0; }
  get canRedo() { return this.i < this.stack.length - 1; }
  undo() { return this.canUndo ? JSON.parse(this.stack[--this.i]) : null; }
  redo() { return this.canRedo ? JSON.parse(this.stack[++this.i]) : null; }
}

export const store = {
  get(key, fallback = null) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
};
