// GLSL ES 3.00 shaders. Fullscreen passes draw one triangle from gl_VertexID;
// the particle cloud is attribute-less too (grid position comes from gl_VertexID).

export const LIB = `
float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z)*2.-1.; }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
float hash1(float n){ return fract(sin(n)*43758.5453); }
vec3 hueShift(vec3 c,float a){ const vec3 k=vec3(.57735); float ca=cos(a); return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.-ca); }
vec3 pal(float t, vec3 d){ return .5+.5*cos(6.28318*(t+d)); }`;

export const VS_QUAD = `#version 300 es
out vec2 vUv;
void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;

export const VS_PART = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform int uCols, uRows;
uniform vec2 uFit, uMouse;
uniform float uAspect,uTime,uNoise,uExplode,uScatter,uDepth,uSize,uRot,uMouseForce,uMouseRad,uTouchMode,uCut,uDpr;
out vec3 vCol; out float vA;
${LIB}
void main(){
  int id=gl_VertexID; int x=id%uCols; int y=id/uCols;
  vec2 uv=(vec2(x,y)+.5)/vec2(uCols,uRows);
  vec3 c=textureLod(uSrc,uv,1.).rgb; float l=lum(c);
  vec3 p=vec3((uv*2.-1.)*uFit, (l-.5)*uDepth);
  float rnd=fract(sin(float(id)*12.9898)*43758.5453);
  float rnd2=fract(rnd*7.31+.17);
  p.xy += (vec2(rnd,rnd2)-.5)*uScatter*.3;
  vec3 q=vec3(uv*2.5, uTime*.15);
  vec3 n=vec3(noise(q),noise(q+vec3(13.1,0,0)),noise(q+vec3(0,27.3,0)));
  p += n*uNoise*(.15+.35*l);
  p += normalize(vec3(p.xy,.2)+n*.8)*uExplode*(.3+rnd*1.2);
  vec2 d=p.xy-uMouse; float r=length(d); vec2 dir=d/(r+1e-4);
  float push=uMouseForce*exp(-r*r/(uMouseRad*uMouseRad));
  vec2 v = uTouchMode<.5 ? dir : (uTouchMode<1.5 ? -dir*min(1.,r*3.) : vec2(-dir.y,dir.x));
  p.xy += v*push*.3*uMouseRad; p.z += push*.25*(uTouchMode<1.5 ? 1. : .4);
  float cr=cos(uRot), sr=sin(uRot); p.xz = mat2(cr,-sr,sr,cr)*p.xz;
  float persp=2.6/(2.6-p.z);
  gl_Position=vec4(p.x/uAspect*persp, p.y*persp, 0., 1.);
  float keep=smoothstep(uCut, uCut+.06, l);
  gl_PointSize = keep<.01 ? 0. : uSize*uDpr*persp*(.6+l*.8);
  vCol=c; vA=keep;
}`;

export const FS_PART = `#version 300 es
precision highp float;
in vec3 vCol; in float vA; uniform float uGlow, uShape; out vec4 o;
void main(){
  vec2 c=gl_PointCoord*2.-1.; float d=dot(c,c); float a;
  if(uShape<.5){ if(d>1.) discard; a=exp(-d*3.); }
  else if(uShape<1.5){ if(d>1.) discard; a=1.-smoothstep(.65,1.,d); }
  else { a=.85; }
  o=vec4(vCol*a*vA*uGlow,1.);
}`;

export const FS_IMG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uFit, uMouse; uniform float uAspect,uTime,uMouseForce,uMouseRad,uTouchMode;
void main(){
  vec2 p=vec2((vUv.x*2.-1.)*uAspect, vUv.y*2.-1.);
  vec2 d=p-uMouse; float r=length(d); vec2 dir=d/(r+1e-4);
  float f=exp(-r*r/(uMouseRad*uMouseRad))*uMouseForce;
  if(uTouchMode<.5) p -= dir*sin(r*28.-uTime*6.)*f*.025;
  else if(uTouchMode<1.5) p -= d*f*.45;
  else { float a=f*1.4; float c=cos(a), s=sin(a); p=uMouse+mat2(c,-s,s,c)*d; }
  vec2 uv=p/uFit*.5+.5;
  if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))){ o=vec4(0,0,0,1); return; }
  o=vec4(texture(uSrc,uv).rgb,1.);
}`;

export const FS_BLIT = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uTime, u_grain, u_vignette;
void main(){
  vec3 c=texture(uTex,vUv).rgb; vec2 p=vUv-.5; c*=1.-dot(p,p)*u_vignette*1.3;
  float g=fract(sin(dot(gl_FragCoord.xy+fract(uTime)*97.,vec2(12.9898,78.233)))*43758.5453);
  o=vec4(c+(g-.5)*.08*u_grain,1.);
}`;

// Face blur runs on the source texture (y up) before the scene, so every later effect sees hidden faces.
export const FS_FACE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uSrcSize; uniform vec4 uFaces[16]; uniform int uCount;
uniform float u_mode, u_strength, u_padding, u_feather, u_outline, uCover;
void main(){
  vec3 base=textureLod(uSrc,vUv,0.).rgb;
  float m=uCover, ring=0., big=0.;
  for(int i=0;i<16;i++){
    if(i>=uCount) break;
    vec4 f=uFaces[i]; vec2 r=f.zw*vec2(1.+u_padding, 1.+u_padding*1.25);
    vec2 d=(vUv-f.xy)/r; d.y=d.y>0. ? d.y*.85 : d.y;   // a little extra room above for hair
    float e=length(d);
    m=max(m, 1.-smoothstep(1.-u_feather*.8-.002, 1., e));
    ring=max(ring, 1.-smoothstep(.0, .025, abs(e-1.)));
    big=max(big, max(r.x*uSrcSize.x, r.y*uSrcSize.y));
  }
  if(uCover>0.) big=max(uSrcSize.x,uSrcSize.y)*.35;
  vec3 col=base;
  if(m>0.){
    vec3 fx;
    if(u_mode<.5){
      float R=max(2., big*u_strength*.32); float lod=max(0., log2(R/5.));
      vec3 s=vec3(0);
      for(int k=0;k<32;k++){ float a=float(k)*2.39996; float rr=sqrt((float(k)+.5)/32.)*R;
        s+=textureLod(uSrc, vUv+vec2(cos(a),sin(a))*rr/uSrcSize, lod).rgb; }
      fx=s/32.;
    } else if(u_mode<1.5){
      float cell=max(4., big*u_strength*.22); vec2 g=uSrcSize/cell; vec2 q=(floor(vUv*g)+.5)/g;
      fx=textureLod(uSrc, q, max(0., log2(cell)-1.)).rgb;
    } else {
      fx=vec3(.05,.05,.06);
    }
    col=mix(base, fx, m);
  }
  if(u_outline>.5 && uCover<=0.) col=mix(col, vec3(1.,.71,.28), ring*.9);
  o=vec4(col,1.);
}`;

const HEAD = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uIn; uniform vec2 uRes; uniform float uTime, uAspect;
${LIB}
`;

export const OP_FS = {
  displace: HEAD + `uniform float u_amount,u_scale,u_speed;
void main(){ float t=uTime*u_speed*.25; vec2 q=vUv;
  vec2 w=vec2(noise(vec3(q*u_scale,t)), noise(vec3(q*u_scale+19.7,t)));
  o=vec4(texture(uIn,q+w*u_amount*.08).rgb,1.); }`,

  kaleido: HEAD + `uniform float u_segments,u_spin_acc,u_zoom;
void main(){ vec2 p=vUv-.5; p.x*=uAspect; float r=length(p)/u_zoom; float a=atan(p.y,p.x)+u_spin_acc;
  float s=6.28318/max(u_segments,2.); a=mod(a,s); a=abs(a-s*.5); p=vec2(cos(a),sin(a))*r; p.x/=uAspect;
  o=vec4(texture(uIn,p+.5).rgb,1.); }`,

  mirror: HEAD + `uniform float u_mode;
void main(){ vec2 q=vUv;
  if(u_mode<.5||u_mode>1.5) q.x=.5-abs(q.x-.5);
  if(u_mode>.5) q.y=.5-abs(q.y-.5);
  o=vec4(texture(uIn,q).rgb,1.); }`,

  glitch: HEAD + `uniform float u_amount,u_bands,u_speed;
void main(){ vec2 q=vUv; float row=floor(q.y*u_bands), tt=floor(uTime*(2.+u_speed*16.));
  float h=hash1(row*7.13+tt);
  if(h<u_amount*.4) q.x+=(hash1(row+tt*3.1)-.5)*.3*u_amount;
  vec3 c=texture(uIn,q).rgb; if(h<u_amount*.12) c=c.gbr;
  o=vec4(c,1.); }`,

  pixel: HEAD + `uniform float u_size;
void main(){ vec2 g=uRes/u_size; vec2 q=(floor(vUv*g)+.5)/g; o=vec4(texture(uIn,q).rgb,1.); }`,

  halftone: HEAD + `uniform float u_size,u_angle,u_mix;
void main(){ float a=radians(u_angle); mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
  vec2 rp=R*(vUv*uRes); vec2 cell=(floor(rp/u_size)+.5)*u_size;
  vec3 c=texture(uIn,(transpose(R)*cell)/uRes).rgb; float l=lum(c);
  float d=length(rp-cell)/(u_size*.5); float rad=sqrt(clamp(l,0.,1.))*1.05;
  float dotv=1.-smoothstep(rad-.12,rad,d);
  vec3 ink=dotv*mix(vec3(l),c/max(max(c.r,max(c.g,c.b)),.05),.75);
  o=vec4(mix(texture(uIn,vUv).rgb,ink,u_mix),1.); }`,

  edge: HEAD + `uniform float u_amount,u_thickness;
float L(vec2 o2){ return lum(texture(uIn,vUv+o2*u_thickness/uRes).rgb); }
void main(){
  float tl=L(vec2(-1,1)),t=L(vec2(0,1)),tr=L(vec2(1,1)),l=L(vec2(-1,0)),r=L(vec2(1,0)),bl=L(vec2(-1,-1)),b=L(vec2(0,-1)),br=L(vec2(1,-1));
  float gx=-tl-2.*l-bl+tr+2.*r+br, gy=-bl-2.*b-br+tl+2.*t+tr;
  float e=clamp(length(vec2(gx,gy))*1.6,0.,1.);
  vec3 c=texture(uIn,vUv).rgb; vec3 ec=e*(.35+1.5*normalize(c+.05));
  o=vec4(mix(c,ec,u_amount),1.); }`,

  ramp: HEAD + `uniform vec3 u_palette; uniform float u_mix,u_cycle_acc;
void main(){ vec3 c=texture(uIn,vUv).rgb; float l=lum(c);
  vec3 p=pal(l*.9+u_cycle_acc*.1,u_palette)*smoothstep(0.,.25,l)*(.35+l);
  o=vec4(mix(c,p,u_mix),1.); }`,

  color: HEAD + `uniform float u_brightness,u_contrast,u_saturation,u_hue;
void main(){ vec3 c=texture(uIn,vUv).rgb; c=hueShift(c,radians(u_hue));
  c=(c-.5)*u_contrast+.5+u_brightness*.5; c=mix(vec3(lum(c)),c,u_saturation);
  o=vec4(clamp(c,0.,1.),1.); }`,

  rgb: HEAD + `uniform float u_amount;
void main(){ vec2 dir=(vUv-.5)*u_amount*.05+vec2(u_amount*.004,0.);
  o=vec4(texture(uIn,vUv+dir).r, texture(uIn,vUv).g, texture(uIn,vUv-dir).b, 1.); }`,

  feedback: HEAD + `uniform sampler2D uPrev; uniform float u_blend,u_amount,u_zoom,u_rotate,u_hue;
void main(){ vec2 f=vUv-.5; f.x*=uAspect; float c=cos(u_rotate*.02), s=sin(u_rotate*.02); f=mat2(c,-s,s,c)*f;
  f/=(1.+u_zoom*.015); f.x/=uAspect; f+=.5;
  vec3 prev=hueShift(texture(uPrev,f).rgb,u_hue*.05); vec3 cur=texture(uIn,vUv).rgb; vec3 r;
  if(u_blend<.5) r=max(cur,prev*u_amount-.006);
  else if(u_blend<1.5) r=cur+max(prev*u_amount-.01,0.)*.55;
  else r=mix(cur,prev,u_amount*.92);
  o=vec4(clamp(r,0.,1.),1.); }`,

  bloom: HEAD + `uniform float u_amount,u_threshold;
void main(){ vec3 c=texture(uIn,vUv).rgb; vec3 b=vec3(0);
  b+=textureLod(uIn,vUv,2.).rgb*.18; b+=textureLod(uIn,vUv,3.).rgb*.22; b+=textureLod(uIn,vUv,4.).rgb*.26;
  b+=textureLod(uIn,vUv,5.).rgb*.3; b+=textureLod(uIn,vUv,6.).rgb*.34;
  b=max(b-u_threshold*.8,0.)*1.8;
  o=vec4(c+b*u_amount*1.4,1.); }`,
};
