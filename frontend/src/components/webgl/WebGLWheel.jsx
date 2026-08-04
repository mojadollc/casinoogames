import React, { useRef, useEffect, useState } from 'react';
import { createWebGLWheel } from './WebGLWheel.js';
import { createWebGLParticles } from './WebGLParticles.js';

/**
 * WebGL animated prize wheel + particle overlay.
 * Props:
 *  - segments: [{label, color, multiplier}]
 *  - targetIndex: number | null  — when set, spins to that segment
 *  - spinning: bool
 *  - onSpinEnd: fn
 *  - size: px
 *  - accent: color
 *  - celebrate: bool (trigger particles)
 */
export default function WebGLWheelView({
  segments = [],
  targetIndex = null,
  spinning = false,
  onSpinEnd,
  size = 300,
  accent = '#FFD700',
  celebrate = false,
}) {
  const wheelCanvas = useRef(null);
  const fxCanvas = useRef(null);
  const wheelApi = useRef(null);
  const fxApi = useRef(null);
  const angleRef = useRef(0);
  const animRef = useRef(null);
  const [webglOk, setWebglOk] = useState(true);
  const [labels, setLabels] = useState([]);

  // Init WebGL
  useEffect(() => {
    if (!wheelCanvas.current) return;
    try {
      wheelApi.current = createWebGLWheel(wheelCanvas.current, segments);
      if (!wheelApi.current) {
        setWebglOk(false);
        return;
      }
      wheelApi.current.resize(size);
      wheelApi.current.draw(0);
    } catch {
      setWebglOk(false);
    }
    if (fxCanvas.current) {
      try {
        fxApi.current = createWebGLParticles(fxCanvas.current);
        fxApi.current?.resize(size, size);
      } catch { /* optional */ }
    }
    return () => {
      cancelAnimationFrame(animRef.current);
      wheelApi.current?.destroy();
      fxApi.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update segments / size
  useEffect(() => {
    if (!wheelApi.current) return;
    wheelApi.current.setSegments(segments);
    wheelApi.current.resize(size);
    wheelApi.current.draw(angleRef.current);
    fxApi.current?.resize(size, size);
    // Label positions for HTML overlay
    const n = segments.length || 1;
    const step = 360 / n;
    setLabels(segments.map((seg, i) => ({
      label: seg.label,
      deg: i * step + step / 2,
    })));
  }, [segments, size]);

  // Celebrate particles
  useEffect(() => {
    if (!celebrate || !fxApi.current) return;
    const col = segments[targetIndex]?.color || accent;
    fxApi.current.burst({ x: size / 2, y: size / 2, color: col, n: 100 });
  }, [celebrate, targetIndex, accent, segments, size]);

  // Spin animation toward targetIndex
  useEffect(() => {
    if (!spinning || targetIndex == null || !wheelApi.current) return;

    const n = segments.length || 1;
    const step = (Math.PI * 2) / n;
    // Segment centers start at -PI/2; we want center of targetIndex under top pointer
    const targetCenter = -Math.PI / 2 + targetIndex * step + step / 2;
    // Rotation angle so that targetCenter maps to -PI/2 (top)
    // rotated_angle = local + angle; want targetCenter + angle ≡ -PI/2 (mod 2PI)
    // angle ≡ -PI/2 - targetCenter
    let desired = -Math.PI / 2 - targetCenter;
    // Normalize relative to current
    const current = angleRef.current;
    let delta = desired - (current % (Math.PI * 2));
    // Normalize delta to [0, 2PI)
    const twoPi = Math.PI * 2;
    delta = ((delta % twoPi) + twoPi) % twoPi;
    const extra = (5 + Math.floor(Math.random() * 3)) * twoPi;
    const finalAngle = current + extra + delta;

    const start = performance.now();
    const duration = 4800;
    const from = current;

    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    cancelAnimationFrame(animRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const a = from + (finalAngle - from) * easeOut(t);
      angleRef.current = a;
      wheelApi.current.draw(a);
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        angleRef.current = finalAngle;
        onSpinEnd && onSpinEnd();
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [spinning, targetIndex, segments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback CSS wheel if WebGL unavailable
  if (!webglOk) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `conic-gradient(${segments.map((s, i) =>
          `${s.color} ${(i / segments.length) * 100}% ${((i + 1) / segments.length) * 100}%`
        ).join(', ')})`,
        boxShadow: `0 0 24px ${accent}66`,
      }} />
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <canvas ref={wheelCanvas} style={{ position: 'absolute', inset: 0, borderRadius: '50%' }} />
      {/* HTML labels rotating with wheel via CSS — approximate; WebGL holds the color wheel */}
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          transform: `rotate(${(angleRef.current * 180) / Math.PI}deg)`,
          pointerEvents: 'none',
        }}
        // Labels updated via rAF would be ideal; simplified static overlay for readability
      />
      <canvas
        ref={fxCanvas}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '50%' }}
      />
      {/* Segment labels as HTML for crisp text */}
      <LabelOverlay size={size} segments={segments} angleRef={angleRef} spinning={spinning} />
    </div>
  );
}

function LabelOverlay({ size, segments, angleRef, spinning }) {
  const ref = useRef(null);

  useEffect(() => {
    let raf;
    const el = ref.current;
    if (!el) return;
    const loop = () => {
      const deg = (angleRef.current * 180) / Math.PI;
      el.style.transform = `rotate(${deg}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [angleRef, spinning]);

  const n = segments.length || 1;
  const step = 360 / n;
  const r = size * 0.32;

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {segments.map((seg, i) => {
        const mid = i * step + step / 2;
        const rad = ((mid - 90) * Math.PI) / 180;
        const x = size / 2 + r * Math.cos(rad);
        const y = size / 2 + r * Math.sin(rad);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `translate(-50%, -50%) rotate(${mid}deg)`,
              color: '#fff',
              fontWeight: 900,
              fontSize: n > 20 ? 9 : n > 10 ? 11 : 13,
              textShadow: '0 1px 3px #000',
              whiteSpace: 'nowrap',
            }}
          >
            {seg.label}
          </div>
        );
      })}
    </div>
  );
}
