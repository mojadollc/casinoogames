import React, { useState, useEffect, useMemo } from 'react';

// Cache for loaded images per theme
const imageCache = new Map();

// Preload theme images
async function preloadThemeImages(themeId, symbols) {
  const cacheKey = themeId || 'default';
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);
  
  const images = {};
  const baseUrl = `/assets/slots/${themeId}/`;
  
  for (const [id, sym] of Object.entries(symbols)) {
    // Try webp then png
    for (const ext of ['webp', 'png']) {
      try {
        const img = new Image();
        img.src = `${baseUrl}${id}.${ext}`;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          setTimeout(reject, 2000); // 2s timeout
        });
        images[id] = img.src;
        break;
      } catch (e) {
        // Try next extension
      }
    }
  }
  
  imageCache.set(cacheKey, images);
  return images;
}

export default function SymbolTile({ id, highlight, small, symbols, theme }) {
  const [images, setImages] = useState({});
  const themeId = theme?.id || 'default';
  
  useEffect(() => {
    preloadThemeImages(themeId, symbols).then(setImages);
  }, [themeId, symbols]);
  
  const s = symbols[id];
  if (!s) return <div className={`tile-base ${small ? 'h-[60px]' : 'h-[100px]'}`} />;
  
  const isScatter = s.type === 'scatter';
  const hasImage = images[id];
  
  const baseClasses = `
    tile-base relative flex items-center justify-center rounded-lg
    ${small ? 'h-[60px]' : 'h-[100px]'}
    ${highlight ? 'ring-4 ring-yellow-300 animate-glow rounded-lg' : ''}
  `.trim();
  
  // Card symbols (A, K, Q, J)
  if (s.card) {
    return (
      <div
        className={`${baseClasses} bg-gradient-to-br from-slate-100 to-slate-300 border-2 border-yellow-500/70 shadow-inner`}
      >
        {hasImage ? (
          <img 
            src={images[id]} 
            alt={s.name || id}
            className="w-full h-full object-contain p-1"
            style={{ maxHeight: small ? 50 : 80 }}
          />
        ) : (
          <span
            className="font-black text-slate-800"
            style={{ fontSize: small ? 28 : 44, fontFamily: 'Georgia, serif' }}
          >
            {s.emoji}
          </span>
        )}
      </div>
    );
  }
  
  // Scatter / Wild / Regular symbols
  return (
    <div
      className={baseClasses}
      style={{
        background: isScatter
          ? 'radial-gradient(circle at 50% 40%, #FFE9A8, #F39C12 70%)'
          : 'linear-gradient(160deg, rgba(255,255,255,0.18), rgba(0,0,0,0.25))',
        boxShadow: isScatter ? '0 0 18px rgba(243,156,18,0.7)' : 'inset 0 0 12px rgba(0,0,0,0.3)',
      }}
    >
      {hasImage ? (
        <img 
          src={images[id]} 
          alt={s.name || id}
          className="w-full h-full object-contain p-1"
          style={{ 
            maxHeight: small ? 50 : 80,
            filter: highlight ? 'drop-shadow(0 0 12px #ffd700)' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'
          }}
        />
      ) : (
        <span style={{ fontSize: small ? 34 : 56, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}>
          {s.emoji}
        </span>
      )}
      {s.multiplier && (
        <span className="absolute bottom-0.5 right-1 text-[10px] font-black text-white bg-fuchsia-600 px-1 rounded-full">
          x{s.multiplier}
        </span>
      )}
      {isScatter && (
        <span className="absolute top-0.5 left-1 text-[8px] font-black text-yellow-900 tracking-wider">
          SCATTER
        </span>
      )}
    </div>
  );
}
