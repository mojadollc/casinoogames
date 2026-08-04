/**
 * WebGL particle burst for wins / celebrations.
 */
const VERT = `
attribute vec2 a_pos;
attribute vec2 a_vel;
attribute float a_life;
attribute vec3 a_color;
attribute float a_size;
uniform float u_time;
uniform vec2 u_resolution;
varying vec3 v_color;
varying float v_alpha;
void main() {
  float t = u_time;
  vec2 p = a_pos + a_vel * t;
  p.y += 40.0 * t * t;
  float life = max(0.0, 1.0 - t / a_life);
  v_alpha = life;
  v_color = a_color;
  vec2 zeroToOne = p / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = a_size * life * (u_resolution.y / 300.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 v_color;
varying float v_alpha;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = dot(c, c);
  if (d > 0.25) discard;
  float glow = smoothstep(0.25, 0.0, d);
  gl_FragColor = vec4(v_color, v_alpha * glow);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

function hexToRgb(hex) {
  const h = (hex || '#FFD700').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export function createWebGLParticles(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  const aVel = gl.getAttribLocation(prog, 'a_vel');
  const aLife = gl.getAttribLocation(prog, 'a_life');
  const aColor = gl.getAttribLocation(prog, 'a_color');
  const aSize = gl.getAttribLocation(prog, 'a_size');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');

  const buf = gl.createBuffer();
  let count = 0;
  let start = 0;
  let running = false;
  let raf = 0;

  function burst({ x, y, color = '#FFD700', n = 80 } = {}) {
    const rgb = hexToRgb(color);
    const gold = hexToRgb('#FFD700');
    const data = [];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 180;
      const col = Math.random() > 0.5 ? rgb : gold;
      data.push(
        x, y,
        Math.cos(ang) * spd, Math.sin(ang) * spd,
        0.6 + Math.random() * 0.9,
        col[0], col[1], col[2],
        4 + Math.random() * 10
      );
    }
    count = n;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    start = performance.now();
    running = true;
    if (!raf) loop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!running) return;
    const t = (performance.now() - start) / 1000;
    if (t > 1.6) {
      running = false;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(prog);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const stride = 36;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aVel);
    gl.vertexAttribPointer(aVel, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(aLife);
    gl.vertexAttribPointer(aLife, 1, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(aSize);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, stride, 32);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  function resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function destroy() {
    cancelAnimationFrame(raf);
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
  }

  return { burst, resize, destroy };
}
