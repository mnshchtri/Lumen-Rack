// WebGL2 renderer: scene pass (particles or image) → one pass per enabled operator, in user order → screen.
import { VS_QUAD, VS_PART, FS_PART, FS_IMG, FS_BLIT, FS_FACE, FS_SEG, FS_MOTION, OP_FS } from './shaders.js';
import { PALS } from './ops.js';

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl; this.canvas = canvas;
    this.P = { part: this.prog(VS_PART, FS_PART), img: this.prog(VS_QUAD, FS_IMG), blit: this.prog(VS_QUAD, FS_BLIT), face: this.prog(VS_QUAD, FS_FACE), seg: this.prog(VS_QUAD, FS_SEG), motion: this.prog(VS_QUAD, FS_MOTION) };
    this.sx = null; this.maskTex = null; this.maskW = 0; this.maskH = 0; this.hasMask = false;
    this.mo = null; this.moI = 0; this.moBuf = null;
    this.faceBuf = new Float32Array(16 * 4); this.fx = null;
    this.ops = {};
    for (const id in OP_FS) this.ops[id] = this.prog(VS_QUAD, OP_FS[id]);
    gl.bindVertexArray(gl.createVertexArray());

    this.src = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.texParams(gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.srcW = 1; this.srcH = 1;
    this.W = 0; this.H = 0; this.t = null; this.pi = 0; this.fbLive = false;
  }

  prog(vs, fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.slice(0, 200));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); p.u[info.name] = gl.getUniformLocation(p, info.name); }
    return p;
  }
  use(p) { this.cur = p; this.gl.useProgram(p); }
  f(name, ...v) {
    const l = this.cur.u[name]; if (l == null) return; const gl = this.gl;
    if (v.length === 1) gl.uniform1f(l, v[0]); else if (v.length === 2) gl.uniform2f(l, v[0], v[1]); else gl.uniform3f(l, v[0], v[1], v[2]);
  }
  f4v(name, arr) { const l = this.cur.u[name]; if (l != null) this.gl.uniform4fv(l, arr); }
  i(name, v) { const l = this.cur.u[name]; if (l != null) this.gl.uniform1i(l, v); }
  texParams(min) {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  bindTex(unit, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

  setSource(el, w, h) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.srcW = w || 1; this.srcH = h || 1;
    const k = Math.min(1, 2048 / Math.max(this.srcW, this.srcH));
    const fw = Math.max(2, Math.round(this.srcW * k)), fh = Math.max(2, Math.round(this.srcH * k));
    if (!this.fx || this.fx.w !== fw || this.fx.h !== fh) {
      if (this.fx) { gl.deleteFramebuffer(this.fx.f); gl.deleteTexture(this.fx.tex); }
      this.fx = { ...this.target(fw, fh), w: fw, h: fh };
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (this.sx) { gl.deleteFramebuffer(this.sx.f); gl.deleteTexture(this.sx.tex); }
      this.sx = { ...this.target(fw, fh), w: fw, h: fh };
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
  }

  setMask(data, w, h) {
    const gl = this.gl;
    if (!this.maskTex) { this.maskTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.maskTex); this.texParams(gl.LINEAR); }
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    this.maskW = w; this.maskH = h; this.hasMask = true;
  }
  clearMask() { this.hasMask = false; }

  /** Cuts people out of the source (after face hiding). Returns the texture later passes should sample. */
  segSource(S, inTex, time) {
    if (!S || !S.on || !this.hasMask || !this.sx) return inTex;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sx.f); gl.viewport(0, 0, this.sx.w, this.sx.h);
    this.use(this.P.seg);
    this.bindTex(0, inTex); this.i('uSrc', 0);
    this.bindTex(1, this.maskTex); this.i('uMask', 1);
    this.f('uSrcSize', this.sx.w, this.sx.h); this.f('uMaskSize', this.maskW, this.maskH); this.f('uTime', time);
    for (const k of ['mode', 'threshold', 'softness', 'blur', 'hue', 'rim']) this.f('u_' + k, S[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.bindTex(0, this.sx.tex); gl.generateMipmap(gl.TEXTURE_2D);
    return this.sx.tex;
  }

  /** Low-res frame differencing. Returns { level 0–1, x, y in texture space (y up) }. */
  motion(prev) {
    const gl = this.gl, MW = 80, MH = 45;
    if (!this.mo) { this.mo = [this.target(MW, MH), this.target(MW, MH)]; this.moBuf = new Uint8Array(MW * MH * 4); }
    const dst = this.mo[1 - this.moI], src = this.mo[this.moI];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, MW, MH);
    this.use(this.P.motion);
    this.bindTex(0, this.src); this.i('uSrc', 0);
    this.bindTex(1, src.tex); this.i('uPrev', 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, MW, MH, gl.RGBA, gl.UNSIGNED_BYTE, this.moBuf);
    this.moI = 1 - this.moI;
    let sum = 0, sx = 0, sy = 0;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const a = this.moBuf[(y * MW + x) * 4 + 3] / 255;
      sum += a; sx += a * (x + .5) / MW; sy += a * (y + .5) / MH;
    }
    const level = Math.min(1, sum / (MW * MH) * 9);
    return sum > .5 ? { level, x: sx / sum, y: sy / sum } : { level, x: prev?.x ?? .5, y: prev?.y ?? .5 };
  }

  /** Hides faces on the source texture. Returns the texture the scene should sample. */
  faceSource(F, faces) {
    if (!F || !F.on || (!faces.cover && !faces.list.length) || !this.fx) return this.src;
    const gl = this.gl, n = Math.min(16, faces.list.length);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fx.f); gl.viewport(0, 0, this.fx.w, this.fx.h);
    this.use(this.P.face); this.bindTex(0, this.src); this.i('uSrc', 0);
    for (let j = 0; j < n; j++) { const t = faces.list[j]; this.faceBuf.set([t.cx, t.cy, t.rx, t.ry], j * 4); }
    this.f4v('uFaces[0]', this.faceBuf); this.i('uCount', n);
    this.f('uSrcSize', this.fx.w, this.fx.h); this.f('uCover', faces.cover ? 1 : 0);
    for (const k of ['mode', 'strength', 'padding', 'feather', 'outline']) this.f('u_' + k, F[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.bindTex(0, this.fx.tex); gl.generateMipmap(gl.TEXTURE_2D);
    return this.fx.tex;
  }

  target(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.RGBA8, w, h);
    this.texParams(gl.LINEAR);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { f, tex };
  }
  resize(w, h) {
    if (w === this.W && h === this.H) return;
    const gl = this.gl;
    if (this.t) for (const o of [this.t.scene, this.t.a, this.t.b, ...this.t.fb]) { gl.deleteFramebuffer(o.f); gl.deleteTexture(o.tex); }
    this.W = w; this.H = h; this.canvas.width = w; this.canvas.height = h;
    this.t = { scene: this.target(w, h), a: this.target(w, h), b: this.target(w, h), fb: [this.target(w, h), this.target(w, h)] };
    this.fbLive = false;
  }

  fit() {
    const aspect = this.W / this.H, sa = this.srcW / this.srcH, s = Math.min(1, aspect / sa) * .92;
    return [sa * s, s];
  }

  /** Draws one frame. Returns the number of particles drawn. */
  render({ E, order, acc, mouse, mouseForce, time, flowT, rot, dpr, compare, faces }) {
    const src = this.segSource(E.segment, this.faceSource(E.faceblur, faces), time);
    const gl = this.gl, { W, H } = this, aspect = W / H, fit = this.fit(), sa = this.srcW / this.srcH;
    const T = E.touch, force = T.on ? mouseForce * T.force : 0;

    if (compare) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      this.use(this.P.img); this.bindTex(0, src); this.i('uSrc', 0);
      this.f('uFit', ...fit); this.f('uMouse', 9, 9); this.f('uAspect', aspect); this.f('uMouseForce', 0); this.f('uMouseRad', .5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return 0;
    }

    // scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.t.scene.f); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    this.bindTex(0, src);
    let count = 0;
    const P = E.particles;
    if (P.on) {
      const cols = Math.round(P.density), rows = Math.max(2, Math.round(cols / sa)); count = cols * rows;
      this.use(this.P.part); this.i('uSrc', 0); this.i('uCols', cols); this.i('uRows', rows);
      this.f('uFit', ...fit); this.f('uMouse', ...mouse); this.f('uAspect', aspect); this.f('uTime', flowT);
      this.f('uNoise', P.turb); this.f('uExplode', P.explode); this.f('uScatter', P.scatter); this.f('uDepth', P.depth);
      this.f('uSize', P.size); this.f('uRot', Math.sin(rot) * .9); this.f('uMouseForce', force); this.f('uMouseRad', T.radius);
      this.f('uTouchMode', T.mode); this.f('uCut', P.cutoff); this.f('uDpr', dpr); this.f('uGlow', P.glow); this.f('uShape', P.shape);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);
    } else {
      this.use(this.P.img); this.i('uSrc', 0); this.f('uFit', ...fit); this.f('uMouse', ...mouse); this.f('uAspect', aspect);
      this.f('uTime', time); this.f('uMouseForce', force); this.f('uMouseRad', T.radius); this.f('uTouchMode', T.mode);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // operator chain
    let cur = this.t.scene, fbUsed = false;
    for (const id of order) {
      const e = E[id]; if (!e || !e.on) continue;
      let dst;
      if (id === 'feedback') {
        if (!this.fbLive) for (const o of this.t.fb) { gl.bindFramebuffer(gl.FRAMEBUFFER, o.f); gl.clear(gl.COLOR_BUFFER_BIT); }
        dst = this.t.fb[1 - this.pi];
      } else dst = cur === this.t.a ? this.t.b : this.t.a;

      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f);
      this.use(this.ops[id]);
      this.bindTex(0, cur.tex); this.i('uIn', 0);
      if (id === 'bloom') { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      if (id === 'feedback') { this.bindTex(1, this.t.fb[this.pi].tex); this.i('uPrev', 1); }
      this.f('uRes', W, H); this.f('uTime', time); this.f('uAspect', aspect);
      for (const k in e) {
        if (k === 'on') continue;
        if (k === 'palette') this.f('u_palette', ...PALS[e[k]].d); else this.f('u_' + k, e[k]);
      }
      const a = acc[id]; if (a) for (const k in a) this.f(`u_${k}_acc`, a[k]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (id === 'bloom') { this.bindTex(0, cur.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); }
      if (id === 'feedback') { fbUsed = true; this.pi = 1 - this.pi; }
      cur = dst;
    }
    this.fbLive = fbUsed;

    // output
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    this.use(this.P.blit); this.bindTex(0, cur.tex); this.i('uTex', 0);
    this.f('uTime', time); this.f('u_grain', E.out.grain); this.f('u_vignette', E.out.vignette);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return count;
  }
}
