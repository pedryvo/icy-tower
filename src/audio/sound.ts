export class SoundManager {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private buffers: Map<string, AudioBuffer> = new Map();
  private bgSource: AudioBufferSourceNode | null = null;
  private currentMusicName: string | null = null;
  private pendingMusicName: string | null = null;
  private isMuted: boolean = false;
  private isLoaded: boolean = false;
  private lastSfxTimes: Map<string, number> = new Map();

  // All sounds converted to standard 44.1 kHz web-friendly MP3
  private soundFiles: Record<string, string> = {
    aight: '/sfx/aight.mp3',
    amazing: '/sfx/amazing.mp3',
    bg_beat: '/sfx/bg_beat.mp3',
    bg_menu: '/sfx/bg_menu.mp3',
    cheer: '/sfx/cheer.mp3',
    edge: '/sfx/edge.mp3',
    extreme: '/sfx/extreme.mp3',
    falling: '/sfx/falling.mp3',
    gameover: '/sfx/gameover.mp3',
    good: '/sfx/good.mp3',
    great: '/sfx/great.mp3',
    hurryup: '/sfx/hurryup.mp3',
    jump_hi: '/sfx/jump_hi.mp3',
    jump_lo: '/sfx/jump_lo.mp3',
    jump_mid: '/sfx/jump_mid.mp3',
    menu_change: '/sfx/menu_change.mp3',
    menu_choose: '/sfx/menu_choose.mp3',
    ring: '/sfx/ring.mp3',
    splat: '/sfx/splat.mp3',
    step: '/sfx/step.mp3',
    sweet: '/sfx/sweet.mp3',
    tryagain: '/sfx/tryagain.mp3',
    wazup: '/sfx/wazup.mp3',
    wow: '/sfx/wow.mp3',
    yo: '/sfx/yo.mp3',
  };

  constructor() {
    this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        
        // Anti-clipping dynamics compressor
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        // Balanced volumes to prevent digital clipping
        this.musicGain.gain.setValueAtTime(0.40, this.ctx.currentTime);
        this.sfxGain.gain.setValueAtTime(0.60, this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      }
    }
    return this.ctx;
  }

  async init(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const loadPromises = Object.entries(this.soundFiles).map(async ([key, path]) => {
      try {
        const res = await fetch(path);
        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.buffers.set(key, audioBuffer);
      } catch (e) {
        console.warn(`Failed to preload audio: ${key} (${path})`, e);
      }
    });

    await Promise.all(loadPromises);
    this.isLoaded = true;

    // If there was a pending music request, trigger it now
    if (this.pendingMusicName && !this.isMuted) {
      const toPlay = this.pendingMusicName;
      this.pendingMusicName = null;
      this.playMusic(toPlay, true);
    }
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (this.pendingMusicName && !this.isMuted) {
          const toPlay = this.pendingMusicName;
          this.pendingMusicName = null;
          this.playMusic(toPlay, true);
        }
      }).catch((err) => {
        console.warn('AudioContext resume failed:', err);
      });
    } else {
      if (this.pendingMusicName && !this.isMuted) {
        const toPlay = this.pendingMusicName;
        this.pendingMusicName = null;
        this.playMusic(toPlay, true);
      }
    }
  }

  playSfx(name: string, volumeScale = 1.0): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Rate-limit identical SFX triggers to prevent harsh constructive interference / phasing distortion
    const now = performance.now();
    const lastTime = this.lastSfxTimes.get(name) || 0;
    if (now - lastTime < 50) {
      return;
    }
    this.lastSfxTimes.set(name, now);

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = Math.min(volumeScale, 1.0);
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start(0);
    } catch (e) {
      console.warn(`Error playing sound ${name}:`, e);
    }
  }

  playMusic(name: string, loop = true): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) {
      this.pendingMusicName = name;
      return;
    }

    // If already playing this track, don't restart it
    if (this.currentMusicName === name && this.bgSource) {
      return;
    }

    if (ctx.state === 'suspended') {
      this.pendingMusicName = name;
      ctx.resume().then(() => {
        if (this.pendingMusicName === name || this.currentMusicName === name) {
          this.playMusic(name, loop);
        }
      }).catch(() => {});
      return;
    }

    const buffer = this.buffers.get(name);
    if (!buffer) {
      this.pendingMusicName = name;
      return;
    }

    this.stopMusic();
    this.currentMusicName = name;
    this.pendingMusicName = null;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      source.connect(this.musicGain);
      source.start(0);
      this.bgSource = source;
    } catch (e) {
      console.warn(`Error playing music ${name}:`, e);
    }
  }

  stopMusic(): void {
    if (this.bgSource) {
      try {
        this.bgSource.stop();
        this.bgSource.disconnect();
      } catch {}
      this.bgSource = null;
    }
    this.currentMusicName = null;
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
    }
    if (this.isMuted) {
      this.stopMusic();
    } else {
      this.unlock();
      this.playMusic('bg_beat', true);
    }
    return this.isMuted;
  }

  get muted(): boolean {
    return this.isMuted;
  }
}
