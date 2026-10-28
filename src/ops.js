// Operator definitions: [key, label, min, max, step, default, unit]
export const FAM = { TOP:'var(--top)', SOP:'var(--sop)', CHOP:'var(--chop)' };
export const OPS = [
  { id:'particles', node:'particlesGPU1', fam:'SOP', label:'Particles', on:true,
    desc:'Every sampled pixel becomes a glowing point. Brighter pixels float toward you.',
    params:[['density','Density',60,420,1,240,' cols'],['size','Point size',.5,8,.1,2,' px'],['depth','Depth from brightness',0,1.5,.01,.55],
      ['turb','Turbulence',0,1,.01,.2],['explode','Explode',0,1.5,.01,0],['speed','Flow speed',0,3,.01,1],
      ['orbit','Orbit',-1,1,.01,.15],['cutoff','Brightness cutoff',0,.9,.01,.04],['glow','Glow',.1,1.5,.01,.7]] },
  { id:'touch', node:'mousein1', fam:'CHOP', label:'Touch', on:true,
    desc:'Your pointer pushes particles and ripples the image.',
    params:[['force','Force',0,2,.01,1],['radius','Radius',.1,1,.01,.4]] },
  { id:'displace', node:'displace1', fam:'TOP', label:'Displace', on:false,
    desc:'Warps the frame through moving noise.',
    params:[['amount','Amount',0,1,.01,.35],['scale','Noise scale',.5,12,.1,3]] },
  { id:'kaleido', node:'kaleido1', fam:'TOP', label:'Kaleidoscope', on:false,
    desc:'Mirrors one wedge of the frame around the center.',
    params:[['segments','Segments',2,16,1,6],['spin','Spin',-1,1,.01,.1]] },
  { id:'rgb', node:'rgbsplit1', fam:'TOP', label:'RGB split', on:false,
    desc:'Pulls the red and blue channels apart.', params:[['amount','Amount',0,1,.01,.3]] },
  { id:'glitch', node:'slice1', fam:'TOP', label:'Slice glitch', on:false,
    desc:'Shifts random horizontal bands sideways.', params:[['amount','Amount',0,1,.01,.4]] },
  { id:'pixel', node:'mosaic1', fam:'TOP', label:'Pixelate', on:false,
    desc:'Snaps the frame to a coarse grid.', params:[['amount','Cell size',0,1,.01,.25]] },
  { id:'edge', node:'edge1', fam:'TOP', label:'Edge', on:false,
    desc:'Keeps only contours, tinted by the original color.', params:[['amount','Mix',0,1,.01,.85]] },
  { id:'ramp', node:'ramp1', fam:'TOP', label:'Color ramp', on:false, pals:true,
    desc:'Remaps brightness onto a gradient.', params:[['mix','Mix',0,1,.01,.8],['cycle','Cycle speed',0,2,.01,.3]] },
  { id:'feedback', node:'feedback1', fam:'TOP', label:'Feedback', on:true,
    desc:'Feeds the last frame back in for trails and tunnels.',
    params:[['amount','Trail length',0,.99,.01,.8],['zoom','Zoom',-2,2,.01,.4],['rotate','Rotate',-2,2,.01,0],['hue','Hue drift',0,2,.01,0]] },
];
export const PALS = [
  { name:'Spectrum', d:[0,.33,.67] }, { name:'Ember', d:[0,.1,.2] },
  { name:'Tide', d:[.5,.6,.7] }, { name:'Dusk', d:[.8,.9,.3] },
];

export const PRESETS = {
  'Particle bloom': {},
  'Dust storm': { particles:{density:320,size:1.4,turb:.8,explode:.45,speed:1.6,orbit:.3}, feedback:{amount:.9,zoom:1.2,rotate:.5}, ramp:{on:1,mix:.55,pal:1} },
  'Mirror temple': { particles:{on:0}, kaleido:{on:1,segments:8,spin:.15}, displace:{on:1,amount:.3}, feedback:{amount:.7,zoom:-.6}, ramp:{on:1,mix:.45,pal:0} },
  'Datamosh': { particles:{on:0}, rgb:{on:1,amount:.5}, glitch:{on:1,amount:.6}, pixel:{on:1,amount:.12}, feedback:{amount:.6,zoom:0} },
  'Neon contour': { particles:{on:0}, edge:{on:1,amount:.9}, ramp:{on:1,mix:.9,cycle:.6,pal:0}, feedback:{amount:.86,zoom:.8,rotate:.4} },
  'Pointillist': { particles:{density:140,size:6,turb:.05,orbit:0,glow:.45,depth:.3}, feedback:{on:0} },
  'Raw': { particles:{on:0}, touch:{on:0}, feedback:{on:0} },
};
