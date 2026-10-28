# Lumen Rack

Realtime GPU effects for your photos and videos, in the browser. Load an image, clip or your camera, then build a look from a chain of operators in the spirit of TouchDesigner: particles, feedback, kaleidoscope, glitch, halftone, bloom and more. Any parameter can be animated by an LFO or by music. Everything runs locally on WebGL2; your files never leave your device.

## Features

**Sources**: photos, videos (with scrubbing), the camera, or the built-in sample. Drag and drop anywhere.

**Face blur**: finds faces with MediaPipe's BlazeFace detector, entirely on your device, and covers them with a mosaic (or blur, or a solid fill) on the source before any other effect runs, so particles, trails and recordings never show a face. It turns on automatically when you start the camera, stays on when you switch presets or randomize, and blurs the whole frame until the model is ready. "Groups & distant faces" also scans four zoomed tiles to catch smaller faces.

**Operators**
| Family | Operator | What it does |
|---|---|---|
| SOP | Particles | Turns pixels into a 3D point cloud: turbulence, explode, scatter, orbit, three point shapes |
| CHOP | Touch | Pointer pushes, pulls or swirls the image |
| TOP | Face blur | Hides detected faces on the source |
| TOP | Displace, Kaleidoscope, Mirror, Slice glitch, Pixelate, Halftone, Edge, Color ramp, Color adjust, RGB split, Feedback, Bloom | Post effects, each its own GPU pass |

**Network**: effects run in the order shown. Drag a node to reorder, click to edit, use the power icon to bypass.

**Animation**: press the wave icon beside any slider to modulate it with an LFO, or with the bass, mid, high or overall level of your mic, a song file or the video's own sound.

**Workflow**: 9 presets plus your own saved ones, randomize, undo/redo, hold-to-compare with the original, share links that encode the whole look, auto-saved session, hide-panels mode, keyboard shortcuts (press `?`). A Face blur switch sits on the viewport (shortcut `P`).

**Export**: PNG snapshots and video recording (MP4 where supported, otherwise WebM), including the song or video audio.

**Performance**: Auto quality lowers the render size when the frame rate drops.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

Camera and microphone need HTTPS or `localhost`.

## Deploy

`dist/` is plain static files. On Cloudflare Workers, `wrangler.jsonc` serves it as static assets: build command `npm run build`, deploy command `npx wrangler deploy`. It also works on GitHub Pages, Netlify or Vercel.

## How it renders

0. **Face blur** (when on): detected face ellipses are blurred on a copy of the source texture, which every later pass samples.
1. **Scene**: the particle cloud (`gl.POINTS` with vertices generated from `gl_VertexID`, no vertex buffers) or the source image with the touch distortion.
2. **Chain**: one fullscreen pass per enabled operator, in network order, ping-ponging between two render targets. Feedback keeps its own pair of textures; bloom samples mipmaps of its input.
3. **Output**: vignette and grain, drawn to the screen.

```
src/
  main.js      app state, actions, input, render loop
  renderer.js  WebGL2 passes and render targets
  shaders.js   GLSL for the scene and every operator
  ops.js       operator definitions, palettes, presets
  ui.js        library, network, inspector, toasts, help
  state.js     validation, share links, undo history, storage
  audio.js     mic / song / video audio analysis
  sources.js   image, video, camera, sample
  recorder.js  video and PNG export
  faces.js     MediaPipe face detection and tracking
public/models/ face_detection_short_range.tflite
scripts/      add-face-model-metadata.py
```

### Face model

`public/models/face_detection_short_range.tflite` is MediaPipe's BlazeFace short-range model (Apache-2.0, from the `@mediapipe/face_detection` package) with TFLite metadata added so the MediaPipe Tasks API accepts it: input normalization to [-1, 1]. `scripts/add-face-model-metadata.py` regenerates it. The MediaPipe WASM runtime is copied from `node_modules` into `dist/mediapipe/` at build time (see `vite.config.js`), so nothing loads from a third-party CDN.

Adding an operator: write a fragment shader in `shaders.js` (`OP_FS.<id>`, reading `uIn` and `u_<param>` uniforms) and add its definition to `OPS` in `ops.js`. The UI, presets, modulation and share links pick it up automatically.
