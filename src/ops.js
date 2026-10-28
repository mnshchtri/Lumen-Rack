// Operator definitions. Each range param maps to a `u_<key>` uniform in that operator's shader.
// Params flagged `acc` are speeds: the renderer also receives their time integral as `u_<key>_acc`.

const R = (k, label, min, max, step, def, unit = '', extra = {}) => ({ k, label, type: 'range', min, max, step, def, unit, ...extra });
const E = (k, label, options, def = 0) => ({ k, label, type: 'enum', options, def });
const PAL = (k = 'palette', label = 'Palette') => ({ k, label, type: 'palette', def: 0 });

export const FAM = { TOP: 'var(--top)', SOP: 'var(--sop)', CHOP: 'var(--chop)' };

export const PALS = [
  { name: 'Spectrum', d: [0, .33, .67] },
  { name: 'Ember', d: [0, .1, .2] },
  { name: 'Tide', d: [.5, .6, .7] },
  { name: 'Dusk', d: [.8, .9, .3] },
  { name: 'Acid', d: [.3, .2, .2] },
];

export const MOD_SOURCES = [
  ['lfo', 'LFO'], ['bass', 'Bass'], ['mid', 'Mid'], ['high', 'High'], ['level', 'Level'], ['motion', 'Motion'],
];

export const OPS = [
  { id: 'faceblur', node: 'faceblur1', fam: 'TOP', stage: 'source', label: 'Face blur', on: false,
    desc: 'Finds faces on your device and covers them with a mosaic before any other effect runs, so particles and trails can’t reveal them either. Nothing is uploaded.',
    params: [
      E('mode', 'Style', ['Mosaic', 'Blur', 'Solid']),
      R('strength', 'Strength', .3, 2, .01, 1),
      R('padding', 'Padding', 0, 1, .01, .35),
      R('feather', 'Soft edge (blur)', 0, 1, .01, .3),
      E('range', 'Look for', ['Close-up faces', 'Groups & distant faces']),
      E('outline', 'Outline', ['Hidden', 'Shown']),
    ] },
  { id: 'segment', node: 'segment1', fam: 'TOP', stage: 'source', label: 'Person cutout', on: false,
    desc: 'Separates people from the background on your device. With Particles on and the background removed, only the person turns into particles.',
    params: [
      E('mode', 'Background', ['Remove', 'Blur', 'Color', 'Keep only background']),
      R('threshold', 'Threshold', .1, .9, .01, .5),
      R('softness', 'Edge softness', 0, .6, .01, .2),
      R('blur', 'Background blur', .2, 2, .01, 1),
      R('hue', 'Color', 0, 360, 1, 260, '°'),
      R('rim', 'Rim light', 0, 1, .01, 0),
    ] },
  { id: 'particles', node: 'particlesGPU1', fam: 'SOP', stage: 'scene', label: 'Particles', on: true,
    desc: 'Every sampled pixel becomes a glowing point. Brighter pixels float toward you.',
    params: [
      R('density', 'Density', 60, 480, 1, 240, ' cols'),
      R('size', 'Point size', .5, 10, .1, 2, ' px'),
      E('shape', 'Shape', ['Soft', 'Disc', 'Square']),
      R('depth', 'Depth from brightness', 0, 1.5, .01, .55),
      R('turb', 'Turbulence', 0, 1, .01, .2),
      R('explode', 'Explode', 0, 1.5, .01, 0),
      R('scatter', 'Scatter', 0, 1, .01, 0),
      R('speed', 'Flow speed', 0, 3, .01, 1),
      R('orbit', 'Orbit', -1, 1, .01, .15),
      R('cutoff', 'Brightness cutoff', 0, .9, .01, .04),
      R('glow', 'Glow', .1, 1.5, .01, .7),
    ] },
  { id: 'touch', node: 'mousein1', fam: 'CHOP', stage: 'chop', label: 'Touch', on: true,
    desc: 'Bends the image around a point: your pointer, wherever there is movement on camera, or a face.',
    params: [E('driver', 'Driven by', ['Pointer', 'Motion', 'Face']), E('mode', 'Mode', ['Push', 'Pull', 'Swirl']),
      R('force', 'Force', 0, 2, .01, 1), R('radius', 'Radius', .1, 1, .01, .4)] },

  { id: 'displace', node: 'displace1', fam: 'TOP', stage: 'post', label: 'Displace', on: false,
    desc: 'Warps the frame through drifting noise.',
    params: [R('amount', 'Amount', 0, 1, .01, .35), R('scale', 'Noise scale', .5, 12, .1, 3), R('speed', 'Speed', 0, 3, .01, 1)] },
  { id: 'kaleido', node: 'kaleido1', fam: 'TOP', stage: 'post', label: 'Kaleidoscope', on: false,
    desc: 'Mirrors one wedge of the frame around the center.',
    params: [R('segments', 'Segments', 2, 16, 1, 6), R('spin', 'Spin', -1, 1, .01, .1, '', { acc: true }), R('zoom', 'Zoom', .3, 3, .01, 1)] },
  { id: 'mirror', node: 'flip1', fam: 'TOP', stage: 'post', label: 'Mirror', on: false,
    desc: 'Folds the frame onto itself for instant symmetry.',
    params: [E('mode', 'Axis', ['Left ↔ right', 'Top ↕ bottom', 'Four-way'])] },
  { id: 'glitch', node: 'slice1', fam: 'TOP', stage: 'post', label: 'Slice glitch', on: false,
    desc: 'Shifts random horizontal bands sideways and swaps their channels.',
    params: [R('amount', 'Amount', 0, 1, .01, .4), R('bands', 'Bands', 4, 64, 1, 24), R('speed', 'Rate', 0, 1, .01, .5)] },
  { id: 'pixel', node: 'mosaic1', fam: 'TOP', stage: 'post', label: 'Pixelate', on: false,
    desc: 'Snaps the frame to a coarse grid.',
    params: [R('size', 'Cell size', 2, 64, 1, 10, ' px')] },
  { id: 'halftone', node: 'halftone1', fam: 'TOP', stage: 'post', label: 'Halftone', on: false,
    desc: 'Prints the frame as a screen of dots, like newsprint.',
    params: [R('size', 'Dot spacing', 4, 32, 1, 10, ' px'), R('angle', 'Screen angle', 0, 90, 1, 45, '°'), R('mix', 'Mix', 0, 1, .01, 1)] },
  { id: 'edge', node: 'edge1', fam: 'TOP', stage: 'post', label: 'Edge', on: false,
    desc: 'Keeps only the contours, tinted by the original color.',
    params: [R('amount', 'Mix', 0, 1, .01, .85), R('thickness', 'Thickness', .5, 4, .1, 1.5)] },
  { id: 'ramp', node: 'ramp1', fam: 'TOP', stage: 'post', label: 'Color ramp', on: false,
    desc: 'Remaps brightness onto a gradient.',
    params: [PAL(), R('mix', 'Mix', 0, 1, .01, .8), R('cycle', 'Cycle speed', 0, 2, .01, .3, '', { acc: true })] },
  { id: 'color', node: 'level1', fam: 'TOP', stage: 'post', label: 'Color adjust', on: false,
    desc: 'Brightness, contrast, saturation and hue.',
    params: [R('brightness', 'Brightness', -1, 1, .01, 0), R('contrast', 'Contrast', 0, 2, .01, 1), R('saturation', 'Saturation', 0, 2, .01, 1), R('hue', 'Hue', -180, 180, 1, 0, '°')] },
  { id: 'rgb', node: 'rgbsplit1', fam: 'TOP', stage: 'post', label: 'RGB split', on: false,
    desc: 'Pulls the red and blue channels apart.',
    params: [R('amount', 'Amount', 0, 1, .01, .3)] },
  { id: 'feedback', node: 'feedback1', fam: 'TOP', stage: 'post', label: 'Feedback', on: true,
    desc: 'Feeds the previous frame back in for trails and tunnels.',
    params: [E('blend', 'Blend', ['Lighten', 'Add', 'Mix']), R('amount', 'Trail length', 0, .99, .01, .8), R('zoom', 'Zoom', -2, 2, .01, .4),
      R('rotate', 'Rotate', -2, 2, .01, 0), R('hue', 'Hue drift', 0, 2, .01, 0)] },
  { id: 'bloom', node: 'bloom1', fam: 'TOP', stage: 'post', label: 'Bloom', on: true,
    desc: 'Lets bright areas glow into their surroundings.',
    params: [R('amount', 'Amount', 0, 1.5, .01, .35), R('threshold', 'Threshold', 0, 1, .01, .35)] },

  { id: 'out', node: 'out1', fam: 'TOP', stage: 'out', label: 'Output', on: true, always: true,
    desc: 'Final image settings. Auto quality lowers the render size if the frame rate drops.',
    params: [E('quality', 'Quality', ['Auto', 'Full', 'Balanced', 'Fast']), R('vignette', 'Vignette', 0, 1, .01, .45), R('grain', 'Grain', 0, 1, .01, .3)] },
];

export const OPMAP = Object.fromEntries(OPS.map(o => [o.id, o]));
export const DEFAULT_ORDER = OPS.filter(o => o.stage === 'post').map(o => o.id);

export const PRESETS = [
  { name: 'Particle bloom', sw: ['#ffb547', '#c2416b'], s: {} },
  { name: 'Dust storm', sw: ['#ff7a2f', '#3a1a0a'], s: { ops: {
    particles: { density: 340, size: 1.4, turb: .8, explode: .45, speed: 1.6, orbit: .3 },
    feedback: { amount: .9, zoom: 1.2, rotate: .5 }, ramp: { on: 1, mix: .55, palette: 1 } } } },
  { name: 'Mirror temple', sw: ['#b18cff', '#2fd2c9'], s: { ops: {
    particles: { on: 0 }, kaleido: { on: 1, segments: 8, spin: .15 }, displace: { on: 1, amount: .3 },
    feedback: { amount: .7, zoom: -.6 }, ramp: { on: 1, mix: .45, palette: 0 } } } },
  { name: 'Datamosh', sw: ['#ff3d71', '#2a7bff'], s: { ops: {
    particles: { on: 0 }, rgb: { on: 1, amount: .5 }, glitch: { on: 1, amount: .6 }, pixel: { on: 1, size: 6 },
    feedback: { amount: .6, zoom: 0 }, bloom: { on: 0 } } } },
  { name: 'Neon contour', sw: ['#39f3ff', '#ff2bd6'], s: { ops: {
    particles: { on: 0 }, edge: { on: 1, amount: .95 }, ramp: { on: 1, mix: .9, cycle: .6, palette: 0 },
    feedback: { amount: .86, zoom: .8, rotate: .4 }, bloom: { amount: .7 } } } },
  { name: 'Pointillist', sw: ['#f2e3c6', '#4a6a8c'], s: { ops: {
    particles: { density: 140, size: 6, shape: 1, turb: .05, orbit: 0, glow: .45, depth: .3 }, feedback: { on: 0 }, bloom: { on: 0 } } } },
  { name: 'Print shop', sw: ['#111111', '#ffd400'], s: { ops: {
    particles: { on: 0 }, halftone: { on: 1, size: 9, angle: 45, mix: 1 }, color: { on: 1, contrast: 1.3, saturation: 1.4 },
    feedback: { on: 0 }, bloom: { on: 0 } } } },
  { name: 'Pulse', sw: ['#7cff6b', '#1b3cff'], s: {
    ops: { particles: { turb: .35 }, bloom: { amount: .6 }, feedback: { amount: .85 }, ramp: { on: 1, mix: .35, palette: 4 } },
    mods: {
      'particles.explode': { src: 'bass', rate: .5, depth: .6 },
      'feedback.zoom': { src: 'lfo', rate: .12, depth: .35 },
      'bloom.amount': { src: 'level', rate: .5, depth: .5 },
      'particles.size': { src: 'lfo', rate: .4, depth: .08 },
    } } },
  { name: 'Spotlight', sw: ['#ff9de2', '#2b0a3d'], s: { ops: {
    segment: { on: 1, mode: 0, rim: .8, hue: 300 }, particles: { density: 300, size: 1.8, cutoff: .02, turb: .3, orbit: .2 },
    touch: { driver: 1 }, feedback: { amount: .86, zoom: .6 }, bloom: { amount: .7 } },
    mods: { 'particles.explode': { src: 'motion', rate: .5, depth: .5 } } } },
  { name: 'Raw', sw: ['#5c5a69', '#18181f'], s: { ops: { particles: { on: 0 }, touch: { on: 0 }, feedback: { on: 0 }, bloom: { on: 0 } } } },
];
