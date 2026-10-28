# Lumen Rack

Realtime effect rack for photos and videos, in the browser. Load an image or clip and run it through a chain of GPU operators in the spirit of TouchDesigner: particles, feedback trails, kaleidoscope, glitch, edge detection and color ramps. Everything runs locally on WebGL2; files never leave your machine.

## Features

- **GPU particles**: every sampled pixel becomes a point; brightness drives depth. Turbulence, explode, orbit, cutoff, glow.
- **Touch**: the pointer pushes particles and ripples the image (hold to push harder).
- **Post chain**: displace, kaleidoscope, RGB split, slice glitch, pixelate, edge, color ramp, feedback.
- **Node strip**: click an operator to bypass it, like a TouchDesigner network.
- **Presets and Randomize**.
- **Export**: PNG snapshot and video recording (MP4 where the browser supports it, otherwise WebM).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

The `dist/` folder is plain static files, so you can host it on GitHub Pages, Netlify, Vercel or any web server.

## How it renders

Each frame takes three passes:

1. **Scene**: either the particle cloud (`gl.POINTS`, vertices generated from `gl_VertexID` with no vertex buffers) or the source image with a pointer ripple.
2. **Post**: a single fragment shader applies the enabled operators in order, then blends in the previous frame for feedback (ping-pong framebuffers).
3. **Blit**: draws to the screen with vignette and grain.

```
src/
  main.js      UI, sources, pointer input, render loop
  ops.js       operator definitions, palettes, presets
  shaders.js   GLSL ES 3.00 shaders
  sample.js    procedural sample image
  recorder.js  MediaRecorder video export, PNG save
```

## Roadmap

- Visual node graph for wiring operators in any order
- Audio-reactive parameters (Web Audio `AnalyserNode`)
- Webcam input
- Save and share custom presets
