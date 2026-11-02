import { WasmPhysics } from './wasm/loader';
import { SFX_FLAGS } from './wasm/types';
import { SoundManager } from './audio/sound';
import { Renderer } from './render/renderer';
import { InputManager } from './ui/touch';
import { getSystemLanguage, getTranslations, type Language } from './i18n';

class GameApp {
  private canvas: HTMLCanvasElement;
  private wasm: WasmPhysics = new WasmPhysics();
  private sound: SoundManager = new SoundManager();
  private renderer: Renderer;
  private input: InputManager;
  
  private state: 'title' | 'playing' | 'paused' | 'gameover' = 'title';
  private currentLang: Language = getSystemLanguage();
  private lastTime: number = 0;
  private physicsAccumulator: number = 0;
  private readonly FIXED_STEP: number = 1000 / 60; // 60 Hz physics
  private highScore: number = 0;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Game canvas element not found');
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);

    // Load persistent high score
    const saved = localStorage.getItem('icytower_highscore');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) {
        this.highScore = parsed;
      }
    }

    // Connect input manager with sound unlocking
    this.input = new InputManager(() => {
      this.sound.unlock();
      if (this.state === 'title') {
        this.sound.playMusic('bg_menu', true);
      }
    });
  }

  async start(): Promise<void> {
    // 1. Initialize Renderer & load textures
    await this.renderer.loadAssets();
    this.renderer.resize();

    // 2. Initialize WASM physics core
    await this.wasm.init();
    this.wasm.exports.init_game(Date.now() & 0xffffffff, 0);

    // 3. Initialize Audio
    await this.sound.init();

    // 4. Attach resize listener
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // 5. Attach audio unlock to any interaction event
    const unlockAndPlayTitle = () => {
      this.sound.unlock();
      if (this.state === 'title') {
        this.sound.playMusic('bg_menu', true);
      }
    };
    ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'].forEach((evt) => {
      window.addEventListener(evt, unlockAndPlayTitle, { passive: true });
    });

    // 6. Setup UI Button Handlers
    this.setupUI();

    // 7. Start Game Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private setupUI(): void {
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) {
      btnMute.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sound.unlock();
        const muted = this.sound.toggleMute();
        btnMute.textContent = muted ? '🔇' : '🔊';
      });
    }

    const btnFullscreen = document.getElementById('btn-fullscreen');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          btnFullscreen.textContent = '⤓';
        } else {
          document.exitFullscreen().catch(() => {});
          btnFullscreen.textContent = '⤢';
        }
      });
    }

    const btnLang = document.getElementById('btn-lang');
    if (btnLang) {
      const langs: Language[] = ['en', 'pt-BR', 'es', 'de', 'zh-CN'];
      btnLang.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = langs.indexOf(this.currentLang);
        this.currentLang = langs[(idx + 1) % langs.length];
        btnLang.textContent = this.currentLang.toUpperCase();
      });
      btnLang.textContent = this.currentLang.toUpperCase();
    }
  }

  private processSoundEvents(events: number): void {
    if (!events) return;

    if (events & SFX_FLAGS.JUMP_LO) this.sound.playSfx('jump_lo');
    if (events & SFX_FLAGS.JUMP_MID) this.sound.playSfx('jump_mid');
    if (events & SFX_FLAGS.JUMP_HI) this.sound.playSfx('jump_hi');
    if (events & SFX_FLAGS.STEP) this.sound.playSfx('step', 0.5);
    if (events & SFX_FLAGS.EDGE) this.sound.playSfx('edge');
    if (events & SFX_FLAGS.BOUNCE) this.sound.playSfx('aight', 0.8);
    if (events & SFX_FLAGS.HURRYUP) this.sound.playSfx('hurryup');
    if (events & SFX_FLAGS.RING) this.sound.playSfx('ring');
    if (events & SFX_FLAGS.FALLING) this.sound.playSfx('falling');
    if (events & SFX_FLAGS.SPLAT) this.sound.playSfx('splat');
    if (events & SFX_FLAGS.GAMEOVER) this.sound.playSfx('gameover');

    // Combo announcer
    let comboSfx = '';
    if (events & SFX_FLAGS.COMBO_GOOD) comboSfx = 'good';
    if (events & SFX_FLAGS.COMBO_SWEET) comboSfx = 'sweet';
    if (events & SFX_FLAGS.COMBO_GREAT) comboSfx = 'great';
    if (events & SFX_FLAGS.COMBO_WOW) comboSfx = 'wow';
    if (events & SFX_FLAGS.COMBO_AMAZING) comboSfx = 'amazing';
    if (events & SFX_FLAGS.COMBO_EXTREME) comboSfx = 'extreme';

    if (comboSfx) {
      this.sound.playSfx(comboSfx, 1.2);
      this.sound.playSfx('cheer', 0.7);
      const px = this.wasm.exports.get_player_x();
      const py = this.wasm.exports.get_player_y();
      this.renderer.spawnComboStars(px, py, 25);
    }
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = Math.min(currentTime - this.lastTime, 100);
    this.lastTime = currentTime;
    this.physicsAccumulator += deltaTime;

    const inp = this.input.input;
    const wasm = this.wasm.exports;

    // Fixed timestep physics update (60 updates per second)
    while (this.physicsAccumulator >= this.FIXED_STEP) {
      this.physicsAccumulator -= this.FIXED_STEP;

      if (this.state === 'title') {
        if (inp.startOrRestart) {
          this.sound.unlock();
          this.sound.playSfx('yo');
          this.sound.playMusic('bg_beat', true);
          wasm.init_game(Date.now() & 0xffffffff, 0);
          this.state = 'playing';
          this.input.resetTriggers();
        }
      } else if (this.state === 'playing') {
        if (inp.pause) {
          this.state = 'paused';
          this.sound.stopMusic();
          this.sound.playSfx('menu_choose');
          this.input.resetTriggers();
        } else {
          wasm.update_physics(
            inp.left ? 1 : 0,
            inp.right ? 1 : 0,
            inp.jump ? 1 : 0
          );

          const events = wasm.get_sound_events();
          this.processSoundEvents(events);

          // Update and persist high score
          const curScore = wasm.get_score();
          if (curScore > this.highScore) {
            this.highScore = curScore;
            localStorage.setItem('icytower_highscore', `${this.highScore}`);
          }

          if (wasm.get_game_over()) {
            this.state = 'gameover';
            this.sound.stopMusic();
          }
        }
      } else if (this.state === 'paused') {
        if (inp.pause || inp.startOrRestart) {
          this.state = 'playing';
          this.sound.playMusic('bg_beat', true);
          this.sound.playSfx('menu_choose');
          this.input.resetTriggers();
        }
      } else if (this.state === 'gameover') {
        if (inp.startOrRestart) {
          this.sound.unlock();
          this.sound.playSfx('tryagain');
          this.sound.playMusic('bg_beat', true);
          wasm.init_game(Date.now() & 0xffffffff, 0);
          this.state = 'playing';
          this.input.resetTriggers();
        }
      }
    }

    // Render current frame with high score
    const t = getTranslations(this.currentLang);
    this.renderer.render(wasm, this.state, t, this.highScore);

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new GameApp();
  app.start().catch((err) => {
    console.error('Failed to initialize game application:', err);
  });
});
