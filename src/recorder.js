// Records the output canvas with MediaRecorder and saves it as a video file.

const TYPES = [
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
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

export function createRecorder(canvas, { fps = 60, bitrate = 16_000_000, onChange } = {}) {
  let rec = null, chunks = [];
  const mime = pickMimeType();

  function start() {
    if (mime === null) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox.');
    const stream = canvas.captureStream(fps);
    rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: bitrate });
    chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/webm';
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      saveBlob(new Blob(chunks, { type }), `lumen-rack-${stamp()}.${ext}`);
      stream.getTracks().forEach(t => t.stop());
      rec = null; onChange?.(false);
    };
    rec.start(250);
    onChange?.(true);
  }
  function stop() { if (rec && rec.state !== 'inactive') rec.stop(); }

  return { start, stop, toggle: () => (rec ? stop() : start()), get recording() { return !!rec; } };
}
