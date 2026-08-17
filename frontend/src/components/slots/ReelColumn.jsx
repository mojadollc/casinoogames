import React, { useRef, useEffect } from 'react';
import { makeReelStrip } from '../../data/gameThemes';
import SymbolTile from './SymbolTile';

export default function ReelColumn({ result, spinning, index, highlightPositions, theme }) {
  const stripRef = useRef([]);

  // Regenerate strip only when a new spin starts
  useEffect(() => {
    if (spinning) stripRef.current = makeReelStrip(theme, 14);
  }, [spinning, theme]);

  return (
    <div className="relative flex-1 h-full overflow-hidden bg-gradient-to-b from-orange-950/50 via-amber-900/30 to-orange-950/50 border-r border-yellow-700/40 last:border-r-0">
      {/* top/bottom fade */}
      <div className="absolute top-0 inset-x-0 h-6 z-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-6 z-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {spinning ? (
        <div className="reel-spinning flex flex-col">
          {[...stripRef.current, ...stripRef.current].map((id, i) => (
            <SymbolTile key={i} id={id} small symbols={theme.symbols} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col animate-reelland">
          {result.map((id, row) => (
            <SymbolTile
              key={row}
              id={id}
              highlight={highlightPositions?.some(p => p[0] === index && p[1] === row)}
              symbols={theme.symbols}
            />
          ))}
        </div>
      )}
    </div>
  );
}
