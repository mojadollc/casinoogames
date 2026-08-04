/**
 * WebGL + Canvas2D Sabong arena renderer.
 * Canvas2D draws animated roosters; WebGL draws dust / impact FX.
 */
function hexRgb(hex) {
  const h = (hex || '#c62828').replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

const PVERT = `
attribute vec2 a_pos; attribute vec2 a_vel; attribute float a_life; attribute vec3 a_color; attribute float a_size;
uniform float u_time; uniform vec2 u_res;
varying vec3 v_c; varying float v_a;
void main() {
  float t = u_time;
  vec2 p = a_pos + a_vel * t;
  p.y += 60.0 * t * t;
  float life = max(0.0, 1.0 - t / a_life);
  v_a = life; v_c = a_color;
  vec2 z = p / u_res; vec2 clip = z * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = a_size * life * (u_res.y / 280.0);
}`;
const PFRAG = `
precision mediump float; varying vec3 v_c; varying float v_a;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = dot(c,c);
  if (d > 0.25) discard;
  gl_FragColor = vec4(v_c, v_a * smoothstep(0.25, 0.0, d));
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s); return s;
}

function createParticles(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, PVERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, PFRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  const locs = {
    pos: gl.getAttribLocation(prog, 'a_pos'),
    vel: gl.getAttribLocation(prog, 'a_vel'),
    life: gl.getAttribLocation(prog, 'a_life'),
    color: gl.getAttribLocation(prog, 'a_color'),
    size: gl.getAttribLocation(prog, 'a_size'),
    time: gl.getUniformLocation(prog, 'u_time'),
    res: gl.getUniformLocation(prog, 'u_res'),
  };
  const buf = gl.createBuffer();
  let count = 0, start = 0, running = false, raf = 0;

  function burst({ x, y, color = '#FFD700', n = 60, speed = 120 }) {
    const rgb = hexRgb(color);
    const dust = hexRgb('#c4a574');
    const data = [];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.3 + Math.random());
      const col = Math.random() > 0.4 ? rgb : dust;
      data.push(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd - 40,
        0.5 + Math.random() * 0.8, col[0], col[1], col[2], 3 + Math.random() * 8);
    }
    count = n;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    start = performance.now(); running = true;
    if (!raf) loop();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!running) return;
    const t = (performance.now() - start) / 1000;
    if (t > 1.4) { running = false; gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.useProgram(prog);
    gl.uniform1f(locs.time, t); gl.uniform2f(locs.res, canvas.width, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const S = 36;
    gl.enableVertexAttribArray(locs.pos); gl.vertexAttribPointer(locs.pos, 2, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(locs.vel); gl.vertexAttribPointer(locs.vel, 2, gl.FLOAT, false, S, 8);
    gl.enableVertexAttribArray(locs.life); gl.vertexAttribPointer(locs.life, 1, gl.FLOAT, false, S, 16);
    gl.enableVertexAttribArray(locs.color); gl.vertexAttribPointer(locs.color, 3, gl.FLOAT, false, S, 20);
    gl.enableVertexAttribArray(locs.size); gl.vertexAttribPointer(locs.size, 1, gl.FLOAT, false, S, 32);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  function resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }

  function destroy() { cancelAnimationFrame(raf); gl.deleteBuffer(buf); gl.deleteProgram(prog); }
  return { burst, resize, destroy };
}

/** Draw a detailed rooster on 2D context at (x,y), facing dir (1 right, -1 left) */
function drawRooster(ctx, x, y, dir, color, phase, pose, scale = 1.35) {
  // pose: idle | walk | attack | hurt | win | lose
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);

  const t = phase;
  let bodyY = 0, bodyRot = 0, neckRot = 0, legL = 0, legR = 0, wing = 0;

  if (pose === 'idle' || pose === 'walk') {
    bodyY = Math.sin(t * 6) * 4;
    legL = Math.sin(t * 8) * (pose === 'walk' ? 0.45 : 0.15);
    legR = Math.sin(t * 8 + Math.PI) * (pose === 'walk' ? 0.45 : 0.15);
    wing = Math.sin(t * 5) * 0.08;
  } else if (pose === 'attack') {
    bodyRot = -0.45; neckRot = -0.65; bodyY = -14;
    wing = 0.6;
  } else if (pose === 'hurt') {
    bodyRot = 0.25; neckRot = 0.3; bodyY = 4;
  } else if (pose === 'win') {
    bodyY = -6 + Math.sin(t * 10) * 3;
    neckRot = -0.2; wing = 0.4 + Math.sin(t * 12) * 0.2;
  } else if (pose === 'lose') {
    bodyRot = 0.9; bodyY = 18; neckRot = 0.4;
  }

  ctx.translate(0, bodyY);
  ctx.rotate(bodyRot);

  const dark = shade(color, -0.3);
  const light = shade(color, 0.25);

  // Tail
  ctx.fillStyle = dark;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const a = -0.4 - i * 0.18;
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-40 - i * 6, -30 - i * 10, -28 - i * 4, -55 - i * 6);
    ctx.quadraticCurveTo(-10, -20, -4, 4);
    ctx.fill();
  }
  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(8, 4, 26, 20, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(12, 0, 14, 10, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Wing
  ctx.save();
  ctx.translate(4, 2);
  ctx.rotate(wing);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(0, 8, 16, 10, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Neck + head
  ctx.save();
  ctx.translate(28, -8);
  ctx.rotate(neckRot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(18, -4, 28, -18);
  ctx.quadraticCurveTo(22, -6, 4, 10);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(30, -20, 11, 0, Math.PI * 2);
  ctx.fill();
  // Comb
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.moveTo(24, -28);
  ctx.quadraticCurveTo(26, -42, 30, -30);
  ctx.quadraticCurveTo(34, -44, 38, -30);
  ctx.quadraticCurveTo(42, -38, 40, -26);
  ctx.fill();
  // Wattle
  ctx.beginPath();
  ctx.ellipse(28, -12, 4, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#ffb300';
  ctx.beginPath();
  ctx.moveTo(40, -20);
  ctx.lineTo(54, -18);
  ctx.lineTo(40, -14);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(34, -22, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(35, -23, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Legs
  ctx.strokeStyle = '#f9a825';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // left
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(-4 + legL * 20, 42);
  ctx.stroke();
  // foot
  ctx.beginPath();
  ctx.moveTo(-4 + legL * 20, 42);
  ctx.lineTo(-12 + legL * 20, 40);
  ctx.moveTo(-4 + legL * 20, 42);
  ctx.lineTo(-4 + legL * 20, 48);
  ctx.moveTo(-4 + legL * 20, 42);
  ctx.lineTo(4 + legL * 20, 46);
  ctx.stroke();
  // right
  ctx.beginPath();
  ctx.moveTo(12, 20);
  ctx.lineTo(16 + legR * 20, 42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16 + legR * 20, 42);
  ctx.lineTo(8 + legR * 20, 40);
  ctx.moveTo(16 + legR * 20, 42);
  ctx.lineTo(16 + legR * 20, 48);
  ctx.moveTo(16 + legR * 20, 42);
  ctx.lineTo(24 + legR * 20, 46);
  ctx.stroke();

  ctx.restore();
}

function shade(hex, amt) {
  try {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    let r = Math.max(0, Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt)));
    let g = Math.max(0, Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt)));
    let b = Math.max(0, Math.min(255, (n & 255) + Math.round(255 * amt)));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  } catch { return hex; }
}

/**
 * Full arena controller bound to two canvases (bg+roosters, fx).
 */
export function createSabongArena(arenaCanvas, fxCanvas) {
  const ctx = arenaCanvas.getContext('2d');
  const fx = createParticles(fxCanvas);
  let w = 400, h = 280;
  let phase = 0;
  let poseM = 'idle', poseW = 'idle';
  let posM = 0.28, posW = 0.72; // normalized x
  let raf = 0;
  let running = true;

  function resize(cssW, cssH) {
    w = cssW; h = cssH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    arenaCanvas.width = Math.floor(cssW * dpr);
    arenaCanvas.height = Math.floor(cssH * dpr);
    arenaCanvas.style.width = cssW + 'px';
    arenaCanvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx?.resize(cssW, cssH);
  }

  function setPoses(m, wl) { poseM = m; poseW = wl; }

  function impact(winnerColor) {
    const cx = w * 0.5, cy = h * 0.55;
    fx?.burst({ x: cx, y: cy, color: winnerColor || '#FFD700', n: 70, speed: 160 });
  }

  function drawBg() {
    // Arena dirt floor
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a1810');
    g.addColorStop(0.45, '#3d2817');
    g.addColorStop(1, '#5d4037');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Ring fence
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    // Ground oval
    ctx.fillStyle = 'rgba(90, 60, 40, 0.5)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.78, w * 0.42, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft center light
    const rg = ctx.createRadialGradient(w / 2, h * 0.5, 10, w / 2, h * 0.5, w * 0.4);
    rg.addColorStop(0, 'rgba(255,200,100,0.08)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    // Labels
    ctx.font = 'bold 12px system-ui';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'left';
    ctx.fillText('MERON', 22, 28);
    ctx.fillStyle = '#64b5f6';
    ctx.textAlign = 'right';
    ctx.fillText('WALA', w - 22, 28);
  }

  function frame(now) {
    if (!running) return;
    phase = now / 1000;
    drawBg();

    // Approach during attack
    let mx = posM, wx = posW;
    if (poseM === 'attack') mx = 0.42;
    if (poseW === 'attack') wx = 0.58;
    if (poseM === 'hurt') mx = 0.22;
    if (poseW === 'hurt') wx = 0.78;

    const groundY = h * 0.72;
    drawRooster(ctx, w * mx, groundY, 1, '#c62828', phase, poseM);
    drawRooster(ctx, w * wx, groundY, -1, '#1565c0', phase + 0.5, poseW);

    // VS
    if (poseM === 'idle' && poseW === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.35, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('VS', w / 2, h * 0.35 + 5);
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    running = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function destroy() {
    stop();
    fx?.destroy();
  }

  return { resize, setPoses, impact, start, stop, destroy };
}
