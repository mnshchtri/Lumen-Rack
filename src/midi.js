// Web MIDI: map hardware knobs and faders (Control Change messages) to any slider with "MIDI learn".
import { store } from './state.js';

const KEY = 'lumen-rack:midi';

export class Midi {
  constructor({ onValue, onLearned, onDevices }) {
    this.access = null;
    this.map = store.get(KEY, {});        // "channel:cc" -> "opId.param"
    this.learning = false; this.armed = null;
    this.onValue = onValue; this.onLearned = onLearned; this.onDevices = onDevices;
  }

  get supported() { return typeof navigator.requestMIDIAccess === 'function'; }
  get enabled() { return !!this.access; }

  async enable() {
    if (this.access) return this.inputs();
    if (!this.supported) throw new Error('This browser has no Web MIDI. Use Chrome or Edge on desktop.');
    this.access = await navigator.requestMIDIAccess();
    const bind = () => {
      for (const input of this.access.inputs.values()) input.onmidimessage = e => this.message(e);
      this.onDevices?.(this.inputs());
    };
    this.access.onstatechange = bind;
    bind();
    return this.inputs();
  }

  inputs() { return this.access ? [...this.access.inputs.values()].map(i => i.name) : []; }

  message(e) {
    const [status, cc, value] = e.data;
    if ((status & 0xf0) !== 0xb0) return;                  // Control Change only
    const key = `${(status & 0x0f) + 1}:${cc}`;
    if (this.learning && this.armed) {
      for (const k in this.map) if (this.map[k] === this.armed || k === key) delete this.map[k];
      this.map[key] = this.armed;
      store.set(KEY, this.map);
      const target = this.armed; this.armed = null;
      this.onLearned?.(target, key);
      return;
    }
    const target = this.map[key];
    if (target) this.onValue?.(target, value / 127);
  }

  /** "CC 21" label for a param, or '' */
  labelFor(target) {
    for (const k in this.map) if (this.map[k] === target) { const [ch, cc] = k.split(':'); return ch === '1' ? `CC ${cc}` : `CC ${cc}·${ch}`; }
    return '';
  }

  unmap(target) {
    for (const k in this.map) if (this.map[k] === target) delete this.map[k];
    store.set(KEY, this.map);
  }
}
