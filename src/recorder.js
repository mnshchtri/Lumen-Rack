// Records the output canvas (plus song or video audio when playing) and saves it as a file.

const TYPES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return TYPES.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export function createRecorder(canvas, { fps = 60, bitrate = 16_000_000, audioTracks = () => [], onChange, onSaved } = {}) {
  let rec = null, chunks = [], started = 0;
  const mime = pickMimeType();

  function start() {
    if (mime === null || !canvas.captureStream) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox.');
    const stream = canvas.captureStream(fps);
    audioTracks().forEach(t => stream.addTrack(t));
    const opts = { videoBitsPerSecond: bitrate };
    if (mime) opts.mimeType = mime;
    rec = new MediaRecorder(stream, opts);
    chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const name = `lumen-rack-${stamp()}.${ext}`;
      saveBlob(new Blob(chunks, { type }), name);
      stream.getVideoTracks().forEach(t => t.stop());
      rec = null; onChange?.(false); onSaved?.(name);
    };
    rec.start(250);
    started = performance.now();
    onChange?.(true);
  }
  function stop() { if (rec && rec.state !== 'inactive') rec.stop(); }

  return {
    start, stop,
    toggle: () => (rec ? stop() : start()),
    get recording() { return !!rec; },
    get elapsed() { return rec ? (performance.now() - started) / 1000 : 0; },
  };
}
