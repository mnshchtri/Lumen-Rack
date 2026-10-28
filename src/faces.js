// On-device face tracking with MediaPipe's BlazeFace short-range detector.
// The model and WASM are served from this site; frames never leave the browser.

const BASE = import.meta.env.BASE_URL;
const HOLD_MS = 700;          // keep a face hidden this long after a missed detection
const MAX_FACES = 16;
// 2×2 overlapping tiles (origin x, origin y) for small or distant faces; each tile covers 60% of the frame.
const TILES = [[0, 0], [.4, 0], [0, .4], [.4, .4]];
const TILE = .6;

export class FaceTracker {
  constructor() {
    this.det = null; this.loading = null; this.status = 'idle'; this.error = null;
    this.tracks = []; this.ts = 0; this.lastRun = 0; this.tileI = 0; this.stillKey = null;
    this.canvas = null;
  }

  load() {
    if (this.det) return Promise.resolve();
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(new URL(BASE + 'mediapipe', location.href).href);
      const opts = delegate => ({
        baseOptions: { modelAssetPath: BASE + 'models/face_detection_short_range.tflite', delegate },
        runningMode: 'VIDEO', minDetectionConfidence: .5, minSuppressionThreshold: .3,
      });
      try { this.det = await FaceDetector.createFromOptions(fileset, opts('GPU')); }
      catch { this.det = await FaceDetector.createFromOptions(fileset, opts('CPU')); }
      this.status = 'ready';
    })().catch(e => { this.status = 'error'; this.error = e; this.loading = null; console.error(e); throw e; });
    return this.loading;
  }

  get ready() { return this.status === 'ready'; }

  /** Runs detection when due and returns the current face ellipses in texture space (y up). */
  update(src, now, { still, group }) {
    if (!this.det || !src) return this.tracks;
    const { el, w, h } = src;
    if (still) {
      const key = `${src.name}|${w}|${h}|${group}`;
      if (this.stillKey === key) return this.tracks;
      this.stillKey = key; this.tracks = [];
      let dets = this.run(el, w, h, 0, 0, 1);
      if (group) for (const [x, y] of TILES) dets = dets.concat(this.run(el, w, h, x, y, TILE));
      this.merge(dets, now, true);
      return this.tracks;
    }
    this.stillKey = null;
    if (now - this.lastRun < 33) { this.expire(now); return this.tracks; }
    this.lastRun = now;
    let dets = this.run(el, w, h, 0, 0, 1);
    if (group) { const [x, y] = TILES[this.tileI++ % TILES.length]; dets = dets.concat(this.run(el, w, h, x, y, TILE)); }
    this.merge(dets, now, false);
    return this.tracks;
  }

  run(el, W, H, fx, fy, fs) {
    let input = el, scale = 1, ox = 0, oy = 0;
    if (fs < 1) {
      const sw = W * fs, sh = H * fs;
      scale = Math.min(2.5, 960 / Math.max(sw, sh));
      const c = this.canvas || (this.canvas = document.createElement('canvas'));
      c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
      c.getContext('2d').drawImage(el, fx * W, fy * H, sw, sh, 0, 0, c.width, c.height);
      input = c; ox = fx * W; oy = fy * H;
    }
    let res;
    try { res = this.det.detectForVideo(input, ++this.ts); } catch { return []; }
    return res.detections.map(d => {
      const b = d.boundingBox, x = ox + b.originX / scale, y = oy + b.originY / scale, bw = b.width / scale, bh = b.height / scale;
      return { cx: (x + bw / 2) / W, cy: 1 - (y + bh / 2) / H, rx: bw / 2 / W, ry: bh / 2 / H, score: d.categories?.[0]?.score ?? 1 };
    });
  }

  merge(dets, now, still) {
    dets.sort((a, b) => b.score - a.score);
    const kept = [];
    for (const d of dets) if (!kept.some(k => Math.hypot(k.cx - d.cx, k.cy - d.cy) < Math.max(k.rx, k.ry) * .9)) kept.push(d);
    const used = new Set();
    for (const d of kept) {
      let best = null, bd = Infinity;
      for (const t of this.tracks) {
        if (used.has(t)) continue;
        const dist = Math.hypot(t.cx - d.cx, t.cy - d.cy);
        if (dist < Math.max(t.rx, t.ry, d.rx, d.ry) * 1.6 && dist < bd) { bd = dist; best = t; }
      }
      if (best) {
        for (const p of ['cx', 'cy', 'rx', 'ry']) best[p] += (d[p] - best[p]) * .7;
        best.seen = now; used.add(best);
      } else if (this.tracks.length < MAX_FACES) {
        const t = { ...d, seen: now }; this.tracks.push(t); used.add(t);
      }
    }
    if (!still) this.expire(now);
  }

  expire(now) { this.tracks = this.tracks.filter(t => now - t.seen < HOLD_MS); }

  reset() { this.tracks = []; this.stillKey = null; }

  statusText() {
    if (this.status === 'loading') return 'Loading the face model… the whole frame stays blurred until it’s ready.';
    if (this.status === 'error') return 'Face detection couldn’t start in this browser, so the whole frame is blurred.';
    if (this.status !== 'ready') return 'Starts when this effect is on.';
    const n = this.tracks.length;
    return n ? `Hiding ${n} face${n > 1 ? 's' : ''}.` : 'No faces in view.';
  }
}
