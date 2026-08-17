import { useRef, useCallback, useEffect, useState } from 'react';
import audioManager from './AudioManager';

/**
 * Hook for slot game sound effects
 * Provides a simple API wrapping the central AudioManager
 */
export default function useSlotSounds() {
  const [muted, setMutedState] = useState(false);
  const soundsPlayedRef = useRef([]);

  // Initialize audio on first use (requires user interaction context)
  useEffect(() => {
    // Sync with AudioManager's initial state
    setMutedState(audioManager.isMuted());
    
    // Stop all sounds played by this hook instance on unmount
    return () => {
      // Stop any currently playing sounds from this instance
      audioManager.stop();
      soundsPlayedRef.current = [];
    };
  }, []);

  const play = useCallback((name) => {
    if (muted) return;
    
    // Map old sound names to new ones
    const soundMap = {
      click: 'button',
      whoosh: 'spin',
      clack: 'reelStop',
      win: 'win',
      bigwin: 'bigWin',
      coins: 'coin',
      coinburst: 'coin',
      scatter: 'scatter',
      freeSpin: 'freeSpin',
      spin: 'spin',
      reelStop: 'reelStop',
      button: 'button',
      coin: 'coin'
    };
    
    const mappedName = soundMap[name] || name;
    const soundId = audioManager.play(mappedName);
    if (soundId !== null) {
      soundsPlayedRef.current.push({ name: mappedName, id: soundId });
    }
    return soundId;
  }, [muted]);

  const setMuted = useCallback((newMuted) => {
    setMutedState(newMuted);
    if (newMuted) {
      audioManager.mute();
    } else {
      audioManager.unmute();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = audioManager.toggleMute();
    setMutedState(newMuted);
    return newMuted;
  }, []);

  const setVolume = useCallback((vol) => {
    audioManager.setEffectsVolume(vol);
  }, []);

  return {
    play,
    setMuted,
    toggleMute,
    isMuted: muted,
    setVolume,
    muted
  };
}
