// Audio analysis for modulation: microphone, a song file, or a video's own soundtrack.
// Exposes smoothed 0–1 levels for bass, mid, high and overall level.

const BANDS = { bass: [20, 150], mid: [150, 2000], high: [2000, 10000] };

export class AudioEngine {
  constructor() {
    this.ctx = null; this.analyser = null; this.data = null; this.dest = null;
    this.node = null; this.stream = null; this.songEl = null; this.songUrl = null;
    this.kind = 'off'; this.label = 'Off';
    this.bands = { bass: 0, mid: 0, high: 0, level: 0 };
    this.elNodes = new WeakMap();
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error('This browser has no Web Audio support.');
      this.ctx = new Ctx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = .6;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.dest = this.ctx.createMediaStreamDestination();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  detach() {
    if (this.node) { try { this.node.disconnect(); } catch { /* already disconnected */ } this.node = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.songEl) { this.songEl.pause(); this.songEl.removeAttribute('src'); this.songEl.load(); this.songEl = null; }
    if (this.songUrl) { URL.revokeObjectURL(this.songUrl); this.songUrl = null; }
    this.kind = 'off'; this.label = 'Off';
  }

  async useMic() {
    this.ensure();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.detach();
    this.stream = stream;
    this.node = this.ctx.createMediaStreamSource(stream);
    this.node.connect(this.analyser); // not to speakers: avoids feedback howl
    this.kind = 'mic'; this.label = 'Microphone';
  }

  /** Routes a media element (video or song) through the analyser and to the speakers. */
  useElement(el, label, kind) {
    this.ensure();
    this.detach();
    let node = this.elNodes.get(el);
    if (!node) { node = this.ctx.createMediaElementSource(el); this.elNodes.set(el, node); }
    node.connect(this.analyser); node.connect(this.ctx.destination); node.connect(this.dest);
    this.node = node; this.kind = kind; this.label = label;
  }

  async useSong(file) {
    this.ensure();
    const url = URL.createObjectURL(file);
    const el = new Audio();
    el.src = url; el.loop = true; el.crossOrigin = 'anonymous';
    this.useElement(el, file.name, 'song');
    this.songEl = el; this.songUrl = url;
    await el.play();
  }

  get recordTracks() {
    return this.dest && (this.kind === 'song' || this.kind === 'video') ? this.dest.stream.getAudioTracks() : [];
  }

  update(dt) {
    const b = this.bands;
    if (!this.analyser || this.kind === 'off') {
      for (const k in b) b[k] *= Math.pow(.02, dt);
      return b;
    }
    this.analyser.getByteFrequencyData(this.data);
    const hz = this.ctx.sampleRate / this.analyser.fftSize;
    const band = ([lo, hi]) => {
      const a = Math.max(1, Math.floor(lo / hz)), z = Math.min(this.data.length - 1, Math.ceil(hi / hz));
      let s = 0; for (let i = a; i <= z; i++) s += this.data[i];
      return s / ((z - a + 1) * 255);
    };
    const raw = {
      bass: band(BANDS.bass) * 1.15,
      mid: band(BANDS.mid) * 1.6,
      high: band(BANDS.high) * 2.4,
    };
    raw.level = (raw.bass + raw.mid + raw.high) / 3;
    for (const k in raw) {
      const v = Math.min(1, Math.pow(Math.max(0, raw[k] - .04) / .96, 1.4));
      const rate = v > b[k] ? 1 - Math.pow(.0001, dt) : 1 - Math.pow(.08, dt); // fast attack, slower release
      b[k] += (v - b[k]) * rate;
    }
    return b;
  }
}
