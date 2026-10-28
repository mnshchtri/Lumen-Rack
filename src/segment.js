// On-device person segmentation with MediaPipe's selfie segmentation (landscape) model.
// Produces a small 8-bit mask (top row first) that the renderer uploads as a texture.

const BASE = import.meta.env.BASE_URL;
const MASK_W = 256;

export class Segmenter {
  constructor() {
    this.seg = null; this.loading = null; this.status = 'idle';
    this.canvas = document.createElement('canvas');
    this.mask = null; this.w = 0; this.h = 0; this.ts = 0; this.last = 0; this.stillKey = null;
  }

  load() {
    if (this.seg) return Promise.resolve();
    if (this.loading) return this.loading;
    this.status = 'loading';
    this.loading = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(new URL(BASE + 'mediapipe', location.href).href);
      const opts = delegate => ({
        baseOptions: { modelAssetPath: BASE + 'models/selfie_segmentation_landscape.tflite', delegate },
        runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false,
      });
      try { this.seg = await ImageSegmenter.createFromOptions(fileset, opts('GPU')); }
      catch { this.seg = await ImageSegmenter.createFromOptions(fileset, opts('CPU')); }
      this.status = 'ready';
    })().catch(e => { this.status = 'error'; this.loading = null; console.error(e); throw e; });
    return this.loading;
  }

  get ready() { return this.status === 'ready'; }

  /** Segments the current source when due. Returns true when a new mask is ready. */
  update(src, now, still) {
    if (!this.seg || !src) return false;
    if (still) {
      const key = `${src.name}|${src.w}|${src.h}`;
      if (this.stillKey === key) return false;
      this.stillKey = key;
    } else {
      this.stillKey = null;
      if (now - this.last < 33) return false;
    }
    this.last = now;
    const c = this.canvas, H = Math.max(2, Math.round(MASK_W * src.h / src.w));
    if (c.width !== MASK_W || c.height !== H) { c.width = MASK_W; c.height = H; }
    c.getContext('2d').drawImage(src.el, 0, 0, MASK_W, H);
    let res;
    try { res = this.seg.segmentForVideo(c, ++this.ts); } catch { return false; }
    const m = res?.confidenceMasks?.[0];
    if (!m) return false;
    const a = m.getAsFloat32Array();
    if (!this.mask || this.mask.length !== a.length) this.mask = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) this.mask[i] = a[i] * 255;
    this.w = m.width; this.h = m.height;
    res.close?.();
    return true;
  }

  reset() { this.stillKey = null; this.mask = null; }

  statusText() {
    if (this.status === 'loading') return 'Loading the person model…';
    if (this.status === 'error') return 'Person detection couldn’t start in this browser.';
    if (this.status !== 'ready') return 'Starts when this effect is on.';
    return 'Tracking people in the frame.';
  }
}
