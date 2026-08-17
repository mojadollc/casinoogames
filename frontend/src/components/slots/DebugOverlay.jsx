import React, { useState, useEffect, useCallback } from 'react';

export default function DebugOverlay({ 
  fps = 0, 
  reelState = [], 
  spinId = '', 
  particleCount = 0, 
  assetStatus = {},
  balance = 0,
  bet = 0,
  lastWin = 0,
  spinning = false,
  stats = {}
}) {
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyStats = useCallback(() => {
    const debugData = {
      timestamp: new Date().toISOString(),
      fps,
      spinId,
      reelState,
      particleCount,
      assetStatus,
      balance,
      bet,
      lastWin,
      spinning,
      stats
    };
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [fps, spinId, reelState, particleCount, assetStatus, balance, bet, lastWin, spinning, stats]);

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed',
          top: 8,
          right: 8,
          padding: '6px 10px',
          background: 'rgba(0, 0, 0, 0.85)',
          border: '1px solid #38d9ff',
          borderRadius: 6,
          color: '#38d9ff',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          zIndex: 99999,
          fontWeight: 600
        }}
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 8,
      right: 8,
      minWidth: 200,
      background: 'rgba(0, 0, 0, 0.92)',
      border: '1px solid #38d9ff',
      borderRadius: 8,
      padding: 10,
      fontSize: 11,
      fontFamily: 'monospace',
      color: '#e0e0e0',
      zIndex: 99999,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
      maxHeight: '90vh',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottom: '1px solid rgba(56, 217, 255, 0.3)'
      }}>
        <span style={{ color: '#38d9ff', fontWeight: 700 }}>🐛 DEBUG MODE</span>
        <button
          onClick={() => setMinimized(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: 14,
            padding: 0
          }}
        >
          −
        </button>
      </div>

      {/* FPS */}
      <DataRow 
        label="FPS" 
        value={fps.toFixed(1)} 
        color={fps >= 55 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#ef4444'} 
      />

      {/* Spin ID */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#888' }}>Spin ID:</span>
        <div style={{ 
          color: '#38d9ff', 
          fontSize: 9, 
          wordBreak: 'break-all',
          marginTop: 2,
          padding: '3px 6px',
          background: 'rgba(56, 217, 255, 0.1)',
          borderRadius: 4
        }}>
          {spinId || '—'}
        </div>
      </div>

      {/* Reel State */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#888' }}>Reels:</span>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {reelState.map((active, i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: active ? '#38d9ff' : '#2a2a2a',
                border: `1px solid ${active ? '#38d9ff' : '#444'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 600,
                color: active ? '#000' : '#666'
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Particle Count */}
      <DataRow label="Particles" value={particleCount} color="#a78bfa" />

      {/* Asset Status */}
      <div style={{ marginBottom: 6 }}>
        <span style={{ color: '#888' }}>Assets:</span>
        <div style={{ marginTop: 4 }}>
          {Object.entries(assetStatus).map(([name, status]) => (
            <div key={name} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              marginBottom: 2,
              fontSize: 10
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: status === 'loaded' ? '#4ade80' : status === 'error' ? '#ef4444' : '#fbbf24'
              }} />
              <span style={{ color: '#aaa' }}>{name}:</span>
              <span style={{ 
                color: status === 'loaded' ? '#4ade80' : status === 'error' ? '#ef4444' : '#fbbf24' 
              }}>
                {status}
              </span>
            </div>
          ))}
          {Object.keys(assetStatus).length === 0 && (
            <span style={{ color: '#666', fontSize: 10 }}>No assets tracked</span>
          )}
        </div>
      </div>

      {/* Game State */}
      <div style={{ 
        marginTop: 8, 
        paddingTop: 8, 
        borderTop: '1px solid rgba(56, 217, 255, 0.3)' 
      }}>
        <span style={{ color: '#888' }}>Game State:</span>
        <div style={{ marginTop: 4 }}>
          <DataRow label="Balance" value={`₱${balance.toFixed(2)}`} color="#ffd75a" small />
          <DataRow label="Bet" value={`₱${bet}`} color="#4ade80" small />
          <DataRow label="Last Win" value={`₱${lastWin}`} color="#ff7f50" small />
          <DataRow label="Spinning" value={spinning ? 'Yes' : 'No'} color={spinning ? '#38d9ff' : '#888'} small />
        </div>
      </div>

      {/* Additional Stats */}
      {Object.keys(stats).length > 0 && (
        <div style={{ 
          marginTop: 8, 
          paddingTop: 8, 
          borderTop: '1px solid rgba(56, 217, 255, 0.3)' 
        }}>
          <span style={{ color: '#888' }}>Stats:</span>
          <div style={{ marginTop: 4 }}>
            {Object.entries(stats).map(([key, value]) => (
              <DataRow key={key} label={key} value={String(value)} color="#e0e0e0" small />
            ))}
          </div>
        </div>
      )}

      {/* Copy Button */}
      <button
        onClick={handleCopyStats}
        style={{
          marginTop: 10,
          width: '100%',
          padding: '6px 10px',
          background: copied ? 'rgba(74, 222, 128, 0.2)' : 'rgba(56, 217, 255, 0.1)',
          border: `1px solid ${copied ? '#4ade80' : '#38d9ff'}`,
          borderRadius: 4,
          color: copied ? '#4ade80' : '#38d9ff',
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {copied ? '✓ Copied!' : '📋 Copy Debug Info'}
      </button>
    </div>
  );
}

function DataRow({ label, value, color = '#e0e0e0', small = false }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      marginBottom: small ? 3 : 6,
      fontSize: small ? 10 : 11
    }}>
      <span style={{ color: '#888' }}>{label}:</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
