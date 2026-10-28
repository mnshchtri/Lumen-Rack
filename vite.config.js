import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Serves MediaPipe's WASM runtime from our own origin (dev) and emits it into dist/mediapipe (build),
// so face detection never depends on a third-party CDN.
const WASM_DIR = resolve('node_modules/@mediapipe/tasks-vision/wasm');
const FILES = [
  'vision_wasm_internal.js', 'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm',
];

function mediapipeWasm() {
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/^\/mediapipe\/([\w.]+)(\?.*)?$/);
        if (!m || !FILES.includes(m[1])) return next();
        res.setHeader('Content-Type', m[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(resolve(WASM_DIR, m[1])));
      });
    },
    generateBundle() {
      for (const f of FILES) this.emitFile({ type: 'asset', fileName: `mediapipe/${f}`, source: readFileSync(resolve(WASM_DIR, f)) });
    },
  };
}

export default defineConfig({
  plugins: [mediapipeWasm()],
});
