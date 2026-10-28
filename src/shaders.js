// GLSL ES 3.00 shaders. Fullscreen passes draw one triangle from gl_VertexID; particles need no vertex buffers.
export const NOISE = `
float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.; }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }`;

export const VS_QUAD = `#version 300 es
out vec2 vUv;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;

export const VS_PART = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform int uCols, uRows;
uniform vec2 uFit, uMouse; uniform float uAspect,uTime,uNoise,uExplode,uDepth,uSize,uRot,uMouseForce,uMouseRad,uCut,uDpr;
out vec3 vCol; out float vA;
${NOISE}
void main(){
  int id=gl_VertexID; int x=id%uCols; int y=id/uCols;
  vec2 uv=(vec2(x,y)+.5)/vec2(uCols,uRows);
  vec3 c=textureLod(uSrc,uv,1.).rgb; float l=lum(c);
  vec3 p=vec3((uv*2.-1.)*uFit, (l-.5)*uDepth);
  float rnd=fract(sin(float(id)*12.9898)*43758.5453);
  vec3 q=vec3(uv*2.5, uTime*.15);
  vec3 n=vec3(noise(q),noise(q+vec3(13.1,0,0)),noise(q+vec3(0,27.3,0)));
  p += n*uNoise*(.15+.35*l);
  p += normalize(vec3(p.xy,.2)+n*.8)*uExplode*(.3+rnd*1.2);
  vec2 d=p.xy-uMouse; float r=length(d);
  float push=uMouseForce*exp(-r*r/(uMouseRad*uMouseRad));
  p.xy += d/(r+1e-4)*push*.3*uMouseRad; p.z += push*.25;
  float cr=cos(uRot), sr=sin(uRot); p.xz = mat2(cr,-sr,sr,cr)*p.xz;
  float persp=2.6/(2.6-p.z);
  gl_Position=vec4(p.x/uAspect*persp, p.y*persp, 0., 1.);
  float keep=smoothstep(uCut, uCut+.06, l);
  gl_PointSize = keep<.01 ? 0. : uSize*uDpr*persp*(.6+l*.8);
  vCol=c; vA=keep;
}`;
export const FS_PART = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; uniform float uGlow; out vec4 o;
void main(){ vec2 c=gl_PointCoord*2.-1.; float d=dot(c,c); if(d>1.) discard; float a=exp(-d*3.)*vA; o=vec4(vCol*a*uGlow,1.); }`;

export const FS_IMG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uFit, uMouse; uniform float uAspect,uTime,uMouseForce,uMouseRad;
void main(){
  vec2 p=vec2((vUv.x*2.-1.)*uAspect, vUv.y*2.-1.);
  vec2 d=p-uMouse; float r=length(d);
  p -= d/(r+1e-4)*sin(r*28.-uTime*6.)*exp(-r*r/(uMouseRad*uMouseRad))*.025*uMouseForce;
  vec2 uv=p/uFit*.5+.5;
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))){ o=vec4(0,0,0,1); return; }
  o=vec4(texture(uSrc,uv).rgb,1.);
}`;

export const FS_POST = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uPrev; uniform vec2 uRes; uniform float uTime,uAspect;
uniform float uWarp,uWarpScale,uKSeg,uKSpin,uRgb,uGlitch,uPixel,uEdge,uRampMix,uRampCycle,uFb,uFbZoom,uFbRot,uFbHue;
uniform vec3 uPd;
${NOISE}
float hash1(float n){ return fract(sin(n)*43758.5453); }
vec3 pal(float t){ return .5+.5*cos(6.28318*(t+uPd)); }
vec3 hueShift(vec3 c,float a){ const vec3 k=vec3(.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.-ca); }
vec3 S(vec2 q){ return texture(uScene,q).rgb; }
void main(){
  vec2 q=vUv;
  if(uKSeg>1.5){ vec2 p=q-.5; p.x*=uAspect; float r=length(p); float a=atan(p.y,p.x)+uKSpin; float s=6.28318/uKSeg;
    a=mod(a,s); a=abs(a-s*.5); p=vec2(cos(a),sin(a))*r; p.x/=uAspect; q=p+.5; }
  if(uWarp>0.){ vec2 w=vec2(noise(vec3(q*uWarpScale,uTime*.25)), noise(vec3(q*uWarpScale+19.7,uTime*.25))); q+=w*uWarp*.08; }
  if(uGlitch>0.){ float row=floor(q.y*24.), tt=floor(uTime*9.); if(hash1(row*7.13+tt)<uGlitch*.35) q.x+=(hash1(row+tt*3.1)-.5)*.25*uGlitch; }
  if(uPixel>0.){ float s=mix(2.,48.,uPixel); vec2 g=uRes/s; q=(floor(q*g)+.5)/g; }
  vec2 dir=(q-.5)*uRgb*.05+vec2(uRgb*.004,0.);
  vec3 col=vec3(S(q+dir).r, S(q).g, S(q-dir).b);
  if(uEdge>0.){ vec2 px=1.5/uRes;
    float gx=lum(S(q+vec2(px.x,0)))-lum(S(q-vec2(px.x,0))), gy=lum(S(q+vec2(0,px.y)))-lum(S(q-vec2(0,px.y)));
    float e=clamp(length(vec2(gx,gy))*5.,0.,1.); col=mix(col, e*(.4+1.4*normalize(col+.05)), uEdge); }
  if(uRampMix>0.){ float l=lum(col); col=mix(col, pal(l*.9+uTime*uRampCycle*.1)*smoothstep(0.,.25,l)*(.35+l), uRampMix); }
  if(uFb>0.){ vec2 f=vUv-.5; f.x*=uAspect; float c=cos(uFbRot*.02), s=sin(uFbRot*.02); f=mat2(c,-s,s,c)*f; f/=(1.+uFbZoom*.015); f.x/=uAspect; f+=.5;
    vec3 pr=hueShift(texture(uPrev,f).rgb, uFbHue*.05); col=max(col, pr*uFb-.006); }
  o=vec4(col,1.);
}`;
export const FS_BLIT = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uTime;
void main(){ vec3 c=texture(uTex,vUv).rgb; vec2 p=vUv-.5; c*=1.-dot(p,p)*.55;
  float g=fract(sin(dot(gl_FragCoord.xy+fract(uTime)*97.,vec2(12.9898,78.233)))*43758.5453); o=vec4(c+(g-.5)*.03,1.); }`;
