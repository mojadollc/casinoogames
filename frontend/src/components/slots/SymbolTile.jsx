import React from 'react';
import { cn } from '../../lib/utils';

export default function SymbolTile({ id, highlight, small, symbols }) {
  const s = symbols[id];
  if (!s) return <div className={cn('tile-base', small && 'h-[60px]')} />;

  const isScatter = s.type === 'scatter';

  if (s.card) {
    return (
      <div
        className={cn(
          'tile-base relative flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-300 border-2 border-yellow-500/70 rounded-lg shadow-inner',
          small ? 'h-[60px]' : 'h-[100px]',
          highlight && 'ring-4 ring-yellow-300 animate-glow'
        )}
      >
        <span
          className="font-black text-slate-800"
          style={{ fontSize: small ? 28 : 44, fontFamily: 'Georgia, serif' }}
        >
          {s.emoji}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'tile-base relative flex items-center justify-center rounded-lg',
        small ? 'h-[60px]' : 'h-[100px]',
        highlight && 'ring-4 ring-yellow-300 animate-glow rounded-lg'
      )}
      style={{
        background: isScatter
          ? 'radial-gradient(circle at 50% 40%, #FFE9A8, #F39C12 70%)'
          : 'linear-gradient(160deg, rgba(255,255,255,0.18), rgba(0,0,0,0.25))',
        boxShadow: isScatter ? '0 0 18px rgba(243,156,18,0.7)' : 'inset 0 0 12px rgba(0,0,0,0.3)',
      }}
    >
      <span style={{ fontSize: small ? 34 : 56, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}>
        {s.emoji}
      </span>
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
