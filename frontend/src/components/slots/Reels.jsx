import React from 'react';
import ReelColumn from './ReelColumn';

export default function Reels({ reels, spinningReels, highlightPositions, theme }) {
  return (
    <div
      className="relative w-full h-[300px] flex rounded-xl overflow-hidden border-2 shadow-2xl"
      style={{ background: theme.reelBg || 'rgba(10,5,24,0.95)', borderColor: 'rgba(250,204,21,0.5)' }}
    >
      {reels.map((col, i) => (
        <ReelColumn
          key={i}
          index={i}
          result={col}
          spinning={spinningReels[i]}
          highlightPositions={highlightPositions}
          theme={theme}
        />
      ))}
      {/* center payline indicator */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[100px] border-y border-yellow-300/30 pointer-events-none" />
    </div>
  );
}
