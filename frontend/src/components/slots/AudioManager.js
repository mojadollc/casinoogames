import { Howl, Howler } from 'howler';

/**
 * AudioManager - Centralized sound management for slot games
 * Uses Howler.js for robust audio playback with volume/mute controls
 */

class AudioManager {
  constructor() {
    this.sounds = {};
    this.muted = false;
    this.masterVolume = 1.0;
    this.musicVolume = 0.5;
    this.effectsVolume = 0.8;
    this.initialized = false;
  }

  // Initialize sounds (call after user interaction to satisfy browser autoplay policies)
  init() {
    if (this.initialized) return;
    
    // Define all game sounds with Web Audio synthesized fallback
    // In production, replace with actual audio file URLs
    this.sounds = {
      spin: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.3,
        rate: 1.0
      }),
      reelStop: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.4
      }),
      win: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.5
      }),
      bigWin: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.7
      }),
      scatter: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.5
      }),
      freeSpin: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.6
      }),
      coin: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.3
      }),
      button: new Howl({
        src: ['data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'],
        volume: 0.2
      })
    };

    // Unlock audio context on first user interaction
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume();
    }
    
    this.initialized = true;
  }

  // Play a sound by name
  play(name, options = {}) {
    if (this.muted || !this.sounds[name]) return null;
    
    this.init();
    
    const sound = this.sounds[name];
    const volume = (options.volume ?? 1) * this.effectsVolume * this.masterVolume;
    
    if (options.sprite) {
      return sound.play(options.sprite);
    }
    
    sound.volume(volume);
    return sound.play();
  }

  // Stop a specific sound or all sounds
  stop(name = null, id = null) {
    if (name && this.sounds[name]) {
      this.sounds[name].stop(id);
    } else {
      Object.values(this.sounds).forEach(s => s.stop());
    }
  }

  // Fade a sound
  fade(name, from, to, duration, id = null) {
    if (this.sounds[name]) {
      this.sounds[name].fade(from, to, duration, id);
    }
  }

  // Set master volume (0-1)
  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    Howler.volume(this.masterVolume);
  }

  // Set music volume
  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
  }

  // Set effects volume
  setEffectsVolume(vol) {
    this.effectsVolume = Math.max(0, Math.min(1, vol));
  }

  // Mute all audio
  mute() {
    this.muted = true;
    Howler.mute(true);
  }

  // Unmute all audio
  unmute() {
    this.muted = false;
    Howler.mute(false);
  }

  // Toggle mute
  toggleMute() {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  // Check if muted
  isMuted() {
    return this.muted;
  }

  // Clean up all sounds
  destroy() {
    Object.values(this.sounds).forEach(sound => {
      sound.unload();
    });
    this.sounds = {};
    this.initialized = false;
  }
}

// Singleton instance
const audioManager = new AudioManager();

export default audioManager;
