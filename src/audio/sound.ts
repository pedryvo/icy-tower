export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private buffers: Map<string, AudioBuffer> = new Map();
  private bgSource: AudioBufferSourceNode | null = null;
  private currentMusicName: string | null = null;
  private pendingMusicName: string | null = null;
  private isMuted: boolean = false;
  private isLoaded: boolean = false;

  private soundFiles: Record<string, string> = {
    aight: '/sfx/aight.wav',
    amazing: '/sfx/amazing.wav',
    bg_beat: '/sfx/bg_beat.wav',
    bg_menu: '/sfx/bg_menu.wav',
    cheer: '/sfx/cheer.wav',
    edge: '/sfx/edge.wav',
    extreme: '/sfx/extreme.wav',
    falling: '/sfx/falling.wav',
    gameover: '/sfx/gameover.wav',
    good: '/sfx/good.wav',
    great: '/sfx/great.wav',
    hurryup: '/sfx/hurryup.wav',
    jump_hi: '/sfx/jump_hi.wav',
    jump_lo: '/sfx/jump_lo.wav',
    jump_mid: '/sfx/jump_mid.wav',
    menu_change: '/sfx/menu_change.wav',
    menu_choose: '/sfx/menu_choose.wav',
    ring: '/sfx/ring.wav',
    splat: '/sfx/splat.wav',
    step: '/sfx/step.wav',
    sweet: '/sfx/sweet.wav',
    tryagain: '/sfx/tryagain.wav',
    wazup: '/sfx/wazup.wav',
    wow: '/sfx/wow.wav',
    yo: '/sfx/yo.wav',
  };

  constructor() {
    this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();

        this.musicGain.gain.value = 0.75;
        this.sfxGain.gain.value = 0.85;
        this.masterGain.gain.value = 1.0;

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
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

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volumeScale;
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
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
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
