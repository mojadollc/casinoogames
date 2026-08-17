import React, { useRef, useEffect, useCallback } from 'react';

/**
 * ModernSlotReels - HTML5 Canvas slot machine with emoji symbols.
 * Matches the style of wolfcasino.profitscripts.online
 * 
 * No PixiJS, no GSAP - pure Canvas + requestAnimationFrame.
 * Smooth, lightweight, mobile-friendly.
 */
export default function ModernSlotReels({
  reels = [],
  spinning = false,
  theme = {},
  height = 380,
  onReady,
  winningPositions = [],
  lastWin = 0,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    symbolStrips: [[], [], [], [], []],
    offsets: [0, 0, 0, 0, 0],
    velocities: [0, 0, 0, 0, 0],
    targetOffsets: [0, 0, 0, 0, 0],
    spinning: [false, false, false, false, false],
    stopped: [true, true, true, true, true],
    rafId: null,
  });

  const symbols = theme?.symbols || {};
  const order = theme?.order || Object.keys(symbols);
  const accentColor = theme?.accent || '#FFD700';

  // Generate random symbol from weighted pool
  const getRandomSymbol = useCallback(() => {
    if (!theme?.weights) {
      return order[Math.floor(Math.random() * order.length)];
    }
    const total = order.reduce((sum, id) => sum + (theme.weights[id] || 1), 0);
    let r = Math.random() * total;
    for (const id of order) {
      r -= theme.weights[id] || 1;
      if (r <= 0) return id;
    }
    return order[order.length - 1];
  }, [theme, order]);

  // Initialize symbol strips
  useEffect(() => {
    const state = stateRef.current;
    const stripLength = 20;
    
    for (let i = 0; i < 5; i++) {
      state.symbolStrips[i] = [];
      for (let j = 0; j < stripLength; j++) {
        state.symbolStrips[i].push(getRandomSymbol());
      }
    }
    
    if (onReady) onReady();
  }, [getRandomSymbol, onReady]);

  // Handle spin state changes
  useEffect(() => {
    const state = stateRef.current;
    const cellHeight = 100;
    const stripHeight = cellHeight * 20;

    if (spinning && !state.spinning.some(s => s)) {
      // Start spin
      for (let i = 0; i < 5; i++) {
        state.spinning[i] = true;
        state.stopped[i] = false;
        state.velocities[i] = 15 + Math.random() * 5; // pixels per frame
        
        // Regenerate strip
        const finalSymbols = reels[i]?.slice(0, 3) || [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
        state.symbolStrips[i] = [];
        for (let j = 0; j < 17; j++) {
          state.symbolStrips[i].push(getRandomSymbol());
        }
        state.symbolStrips[i].push(...finalSymbols);
        
        // Staggered start
        setTimeout(() => {
          if (state.spinning[i]) {
            state.targetOffsets[i] = cellHeight * 17; // 17 cells to spin through
          }
        }, i * 150);
      }
    } else if (!spinning && state.spinning.some(s => s)) {
      // Stop spin - stagger stops
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          state.spinning[i] = false;
          // Snap to final position
          state.targetOffsets[i] = cellHeight * 17;
          state.offsets[i] = state.targetOffsets[i];
          state.stopped[i] = true;
        }, i * 200 + 300);
      }
    }
  }, [spinning, reels, getRandomSymbol]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const state = stateRef.current;
    const cellHeight = 100;
    const stripHeight = cellHeight * 20;
    
    let lastTime = performance.now();
    
    const animate = (time) => {
      const delta = (time - lastTime) / 16.67; // normalize to 60fps
      lastTime = time;
      
      const width = canvas.width;
      const h = canvas.height;
      const reelWidth = (width - 60) / 5;
      const gap = 8;
      const startX = 30;
      
      // Clear
      ctx.clearRect(0, 0, width, h);
      
      // Draw background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#1a0a2e');
      bgGrad.addColorStop(0.5, '#12082a');
      bgGrad.addColorStop(1, '#0a0518');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, h);
      
      // Draw each reel
      for (let i = 0; i < 5; i++) {
        const x = startX + i * (reelWidth + gap);
        
        // Update offset if spinning
        if (state.spinning[i]) {
          state.offsets[i] += state.velocities[i] * delta;
          if (state.offsets[i] > stripHeight) {
            state.offsets[i] -= stripHeight;
          }
        } else if (!state.stopped[i]) {
          // Deceleration
          state.velocities[i] *= 0.92;
          state.offsets[i] += state.velocities[i] * delta;
          if (state.velocities[i] < 0.5) {
            state.offsets[i] = state.targetOffsets[i];
            state.stopped[i] = true;
          }
        }
        
        // Reel viewport clipping
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, 20, reelWidth, h - 40, 12);
        ctx.clip();
        
        // Draw symbols
        const strip = state.symbolStrips[i];
        const offset = state.offsets[i];
        
        for (let j = 0; j < strip.length; j++) {
          const symId = strip[j];
          const sym = symbols[symId] || {};
          const y = 20 + j * cellHeight - (offset % stripHeight);
          
          // Skip if outside viewport
          if (y < -cellHeight || y > h + cellHeight) continue;
          
          // Draw symbol cell
          const cellX = x + 4;
          const cellW = reelWidth - 8;
          const cellH = cellHeight - 8;
          const cellY = y + 4;
          
          // Background
          ctx.fillStyle = sym.type === 'scatter' 
            ? 'rgba(243, 156, 18, 0.15)'
            : sym.type === 'wild'
              ? 'rgba(255, 61, 129, 0.15)'
              : 'rgba(30, 20, 50, 0.85)';
          ctx.beginPath();
          ctx.roundRect(cellX, cellY, cellW, cellH, 10);
          ctx.fill();
          
          // Border
          ctx.strokeStyle = sym.type === 'scatter' 
            ? 'rgba(243, 156, 18, 0.5)'
            : sym.type === 'wild'
              ? 'rgba(255, 61, 129, 0.5)'
              : 'rgba(255, 215, 0, 0.25)';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Glow for scatter/wild
          if (sym.type === 'scatter' || sym.type === 'wild') {
            ctx.shadowColor = sym.type === 'scatter' ? '#F39C12' : '#FF3D81';
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          
          // Emoji
          const emoji = sym.emoji || '?';
          ctx.font = `bold ${cellH * 0.5}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(emoji, cellX + cellW / 2, cellY + cellH / 2);
          
          // Scatter label
          if (sym.type === 'scatter') {
            ctx.font = 'bold 10px Arial';
            ctx.fillStyle = '#F39C12';
            ctx.fillText('SCATTER', cellX + cellW / 2, cellY + 12);
          }
          
          // Wild label
          if (sym.type === 'wild') {
            ctx.font = 'bold 11px Arial';
            ctx.fillStyle = '#FF3D81';
            ctx.fillText('WILD', cellX + cellW / 2, cellY + cellH - 12);
          }
          
          // Multiplier badge
          if (sym.multiplier) {
            ctx.font = 'bold 10px Arial';
            ctx.fillStyle = '#9333ea';
            const badgeW = 28;
            const badgeH = 16;
            const badgeX = cellX + cellW - badgeW - 4;
            const badgeY = cellY + cellH - badgeH - 4;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
            ctx.fillStyle = '#9333ea';
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`x${sym.multiplier}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);
          }
          
          // Card symbols
          if (sym.card) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(cellX + 4, cellY + 4, cellW - 8, cellH - 8);
          }
        }
        
        ctx.restore();
        
        // Draw reel frame
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, 20, reelWidth, h - 40, 12);
        ctx.stroke();
        
        // Top/bottom fade
        const fadeGradTop = ctx.createLinearGradient(0, 20, 0, 50);
        fadeGradTop.addColorStop(0, 'rgba(10, 5, 24, 0.9)');
        fadeGradTop.addColorStop(1, 'rgba(10, 5, 24, 0)');
        ctx.fillStyle = fadeGradTop;
        ctx.fillRect(x, 20, reelWidth, 30);
        
        const fadeGradBottom = ctx.createLinearGradient(0, h - 50, 0, h - 20);
        fadeGradBottom.addColorStop(0, 'rgba(10, 5, 24, 0)');
        fadeGradBottom.addColorStop(1, 'rgba(10, 5, 24, 0.9)');
        ctx.fillStyle = fadeGradBottom;
        ctx.fillRect(x, h - 50, reelWidth, 30);
      }
      
      // Win line
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(20, h / 2);
      ctx.lineTo(width - 20, h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      
      state.rafId = requestAnimationFrame(animate);
    };
    
    state.rafId = requestAnimationFrame(animate);
    
    return () => {
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
      }
    };
  }, [symbols, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={height}
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '16px',
        display: 'block',
      }}
    />
  );
}
