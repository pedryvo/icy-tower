export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private bgSource: AudioBufferSourceNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;
  private unlocked: boolean = false;

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
    // AudioContext will be initialized on first user interaction
  }

  async init(): Promise<void> {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported in this browser');
      return;
    }
    this.ctx = new AudioContextClass();
    
    // Preload common sound effects
    const loadPromises = Object.entries(this.soundFiles).map(async ([key, path]) => {
      try {
        const res = await fetch(path);
        const arrayBuffer = await res.arrayBuffer();
        if (this.ctx) {
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set(key, audioBuffer);
        }
      } catch (e) {
        console.warn(`Failed to preload audio: ${key} (${path})`, e);
      }
    });

    await Promise.all(loadPromises);
  }

  unlock(): void {
    if (this.unlocked) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.unlocked = true;
  }

  playSfx(name: string, volumeScale = 1.0): void {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = this.volume * volumeScale;
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(0);
    } catch (e) {
      console.warn(`Error playing sound ${name}:`, e);
    }
  }

  playMusic(name: string, loop = true): void {
    this.stopMusic();
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;
      const gain = this.ctx.createGain();
      gain.gain.value = this.volume * 0.6; // slightly lower volume for music
      source.connect(gain);
      gain.connect(this.ctx.destination);
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
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopMusic();
    }
    return this.isMuted;
  }

  get muted(): boolean {
    return this.isMuted;
  }
}
