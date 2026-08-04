/**
 * Lightweight WebGL 2D wheel renderer (no external deps).
 * Renders pie segments + hub; rotation applied via uniform.
 */
function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

const VERT = `
attribute vec2 a_pos;
attribute vec3 a_color;
uniform float u_angle;
uniform vec2 u_resolution;
varying vec3 v_color;
void main() {
  float c = cos(u_angle);
  float s = sin(u_angle);
  vec2 p = vec2(a_pos.x * c - a_pos.y * s, a_pos.x * s + a_pos.y * c);
  // Convert to clip space (y-up in clip, canvas is y-down — flip y)
  vec2 zeroToOne = (p + u_resolution * 0.5) / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_color = a_color;
}
`;

const FRAG = `
precision mediump float;
varying vec3 v_color;
void main() {
  gl_FragColor = vec4(v_color, 1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(msg);
  }
  return s;
}

export function createWebGLWheel(canvas, segments = []) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  const aColor = gl.getAttribLocation(prog, 'a_color');
  const uAngle = gl.getUniformLocation(prog, 'u_angle');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');

  const buf = gl.createBuffer();
  let vertexCount = 0;

  function rebuild(segs) {
    const size = Math.min(canvas.width, canvas.height);
    const r = size * 0.46;
    const n = Math.max(segs.length, 1);
    const step = (Math.PI * 2) / n;
    const data = [];
    // Start from top (-PI/2) going clockwise → positive angle in our rotation sense
    const base = -Math.PI / 2;

    for (let i = 0; i < n; i++) {
      const rgb = hexToRgb(segs[i].color);
      const a0 = base + i * step;
      const a1 = base + (i + 1) * step;
      const slices = 12;
      for (let s = 0; s < slices; s++) {
        const t0 = a0 + (a1 - a0) * (s / slices);
        const t1 = a0 + (a1 - a0) * ((s + 1) / slices);
        // triangle: center, rim0, rim1
        data.push(0, 0, ...rgb);
        data.push(Math.cos(t0) * r, Math.sin(t0) * r, ...rgb);
        data.push(Math.cos(t1) * r, Math.sin(t1) * r, ...rgb);
      }
    }

    // Hub disc (gold)
    const hubR = r * 0.14;
    const hubCol = hexToRgb('#FFD700');
    const hubSlices = 24;
    for (let s = 0; s < hubSlices; s++) {
      const t0 = (s / hubSlices) * Math.PI * 2;
      const t1 = ((s + 1) / hubSlices) * Math.PI * 2;
      data.push(0, 0, ...hubCol);
      data.push(Math.cos(t0) * hubR, Math.sin(t0) * hubR, ...hubCol);
      data.push(Math.cos(t1) * hubR, Math.sin(t1) * hubR, ...hubCol);
    }

    vertexCount = data.length / 5;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  }

  rebuild(segments);

  function resize(cssSize) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.floor(cssSize * dpr);
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    gl.viewport(0, 0, px, px);
    rebuild(segments);
  }

  function draw(angleRad) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform1f(uAngle, angleRad);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 20, 8);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  }

  function setSegments(segs) {
    segments = segs || [];
    rebuild(segments);
  }

  function destroy() {
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  }

  return { draw, resize, setSegments, destroy, gl };
}
