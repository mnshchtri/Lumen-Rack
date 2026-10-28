// Visual sources: sample image, photos, videos and the camera.
import { makeSample } from './sample.js';

const MAX_IMAGE = 2048;

export class Sources {
  constructor(renderer, { onChange, onError }) {
    this.r = renderer; this.onChange = onChange; this.onError = onError;
    this.cur = null; this.video = null; this.stream = null; this.url = null; this.lastT = -1;
  }

  clear() {
    if (this.video) { this.video.pause(); this.video.srcObject = null; this.video.removeAttribute('src'); this.video.load(); this.video = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
  }

  set(kind, name, el, w, h) {
    this.cur = { kind, name, el, w, h };
    this.r.setSource(el, w, h);
    this.onChange(this.cur);
  }

  sample() {
    this.clear();
    const c = makeSample();
    this.set('sample', 'Sample image', c, c.width, c.height);
  }

  image(file) {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      this.clear(); this.url = url;
      const w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, MAX_IMAGE / Math.max(w, h));
      let el = im;
      if (k < 1) {
        el = document.createElement('canvas');
        el.width = Math.round(w * k); el.height = Math.round(h * k);
        el.getContext('2d').drawImage(im, 0, 0, el.width, el.height);
      }
      this.set('photo', file.name, el, el.width || w, el.height || h);
      this.cur.origW = w; this.cur.origH = h;
    };
    im.onerror = () => { URL.revokeObjectURL(url); this.onError('That image could not be read. Try a JPG, PNG or WebP.'); };
    im.src = url;
  }

  videoFile(file) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    v.onloadeddata = () => {
      this.clear(); this.url = url; this.video = v; this.lastT = -1;
      this.set('video', file.name, v, v.videoWidth, v.videoHeight);
    };
    v.onerror = () => { URL.revokeObjectURL(url); this.onError('This browser cannot play that video. Try MP4 (H.264) or WebM.'); };
    v.play().catch(() => {});
  }

  async camera() {
    if (!navigator.mediaDevices?.getUserMedia) { this.onError('This browser does not support camera input.'); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch {
      this.onError('Camera access was blocked. Allow it in your browser’s site settings, then try again.');
      return;
    }
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.srcObject = stream;
    await v.play().catch(() => {});
    await new Promise(res => (v.readyState >= 2 ? res() : (v.onloadeddata = res)));
    this.clear(); this.stream = stream; this.video = v; this.lastT = -1;
    this.set('camera', 'Camera', v, v.videoWidth, v.videoHeight);
  }

  /** Uploads the current video frame when it changed. */
  tick() {
    const v = this.video;
    if (!v || v.readyState < 2) return;
    if (this.cur.kind === 'camera' || v.currentTime !== this.lastT) {
      this.lastT = v.currentTime;
      this.r.setSource(v, v.videoWidth, v.videoHeight);
    }
  }
}
