# Lumen Rack

Realtime visuals for your photos, videos and camera, in the browser. Build a look from a chain of GPU operators in the spirit of TouchDesigner (particles, feedback, kaleidoscope, glitch, halftone, bloom and more), then drive it with music, movement, your face or a MIDI controller. Nothing to install, it runs on phones too, and everything stays on your device.

## What it does that a desktop node tool doesn't out of the box

- **Runs anywhere with a link.** No install, no licence, works on a phone. Share a look as a URL.
- **Person cutout.** On-device segmentation removes, blurs or recolors the background, adds a rim light, and makes particles from the person only.
- **Face privacy.** Faces are covered with a mosaic before any effect runs, automatically when the camera starts.
- **Motion as a control.** Movement on camera drives any parameter, or acts as the touch point that pushes the image.
- **Performance tools built in.** MIDI learn, smooth preset morphing, Auto VJ on the beat, and a clean output window for a projector.

## Features

**Sources**: photos, videos (with scrubbing), the camera, or the built-in sample. Drag and drop anywhere.

**Operators**
| Family | Operator | What it does |
|---|---|---|
| TOP | Face blur | Mosaic, blur or solid over detected faces (on-device BlazeFace) |
| TOP | Person cutout | Remove, blur or color the background, or keep only the background; rim light |
| SOP | Particles | Turns pixels into a 3D point cloud: turbulence, explode, scatter, orbit, three point shapes |
| CHOP | Touch | Pushes, pulls or swirls the image around your pointer, the motion on camera, or a face |
| TOP | Displace, Kaleidoscope, Mirror, Slice glitch, Pixelate, Halftone, Edge, Color ramp, Color adjust, RGB split, Feedback, Bloom | Post effects, each its own GPU pass |

**Network**: effects run in the order shown. Drag a node to reorder, click to edit, use the power icon to bypass.

**Animation**: the wave icon beside any slider modulates it with an LFO, the bass, mid, high or overall level of your mic, a song file or the video's sound, or the amount of motion on camera.

**Performance**
- **MIDI learn**: press MIDI, click a slider, move a knob. Mappings are saved in the browser. Chrome and Edge on desktop.
- **Preset morphing**: switching looks glides between them over 1.4 s instead of jumping.
- **Auto VJ**: picks a new look every 16 beats when audio is playing, or every 9 seconds without it.
- **Output window**: a clean, chrome-free window with just the picture. Drag it to a projector and double-click for fullscreen.

**Workflow**: 10 presets plus your own, randomize, undo/redo, hold-to-compare, share links, auto-saved session, hide-panels mode, keyboard shortcuts (press `?`). The Face blur switch sits on the viewport (shortcut `P`). Presets and Randomize never turn face blur off.

**Export**: PNG snapshots and video recording (MP4 where supported, otherwise WebM), including song or video audio.

**Speed**: Auto quality lowers the render size when the frame rate drops.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

Camera, microphone and MIDI need HTTPS or `localhost`.

## Deploy

`dist/` is plain static files. On Cloudflare Workers, `wrangler.jsonc` serves it as static assets: build command `npm run build`, deploy command `npx wrangler deploy`. It also works on GitHub Pages, Netlify or Vercel.

## How it renders

1. **Source**: face blur, then person cutout, each written to a copy of the source texture that every later pass samples.
2. **Scene**: the particle cloud (`gl.POINTS`, vertices generated from `gl_VertexID`, no vertex buffers) or the source image with the touch distortion.
3. **Chain**: one fullscreen pass per enabled operator, in network order, ping-ponging between two render targets. Feedback keeps its own pair of textures; bloom samples mipmaps of its input.
4. **Output**: vignette and grain, drawn to the screen.

Motion is measured with a tiny 80×45 frame-difference pass whose result is read back to get the amount and centre of movement.

```
src/
  main.js      app state, actions, input, render loop, morph, Auto VJ, output window
  renderer.js  WebGL2 passes and render targets
  shaders.js   GLSL for the scene, source passes and every operator
  ops.js       operator definitions, palettes, presets
  ui.js        library, network, inspector, toasts, help
  state.js     validation, share links, undo history, storage
  audio.js     mic / song / video audio analysis
  sources.js   image, video, camera, sample
  faces.js     MediaPipe face detection and tracking
  segment.js   MediaPipe person segmentation
  midi.js      Web MIDI learn and mapping
  recorder.js  video and PNG export
public/models/ face and person models
scripts/       add-model-metadata.py
```

### Models

`public/models/` holds two Apache-2.0 MediaPipe models from npm: BlazeFace short-range (`@mediapipe/face_detection`) and selfie segmentation landscape (`@mediapipe/selfie_segmentation`). Both get TFLite input-normalization metadata so the MediaPipe Tasks API accepts them; `scripts/add-model-metadata.py` regenerates them:

```bash
python3 scripts/add-model-metadata.py face_detection_short_range.tflite public/models/face_detection_short_range.tflite
python3 scripts/add-model-metadata.py selfie_segmentation_landscape.tflite public/models/selfie_segmentation_landscape.tflite 0 255 "Selfie segmentation (landscape)"
```

The MediaPipe WASM runtime is copied from `node_modules` into `dist/mediapipe/` at build time (see `vite.config.js`), so nothing loads from a third-party CDN.

Adding an operator: write a fragment shader in `shaders.js` (`OP_FS.<id>`, reading `uIn` and `u_<param>` uniforms) and add its definition to `OPS` in `ops.js`. The UI, presets, modulation, MIDI and share links pick it up automatically.
