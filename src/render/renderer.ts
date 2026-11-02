import type { WasmPhysicsExports } from '../wasm/types';
import type { TranslationStrings } from '../i18n';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  spriteIndex: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private images: Map<string, HTMLImageElement> = new Map();
  private particles: Particle[] = [];
  
  // Logical game resolution
  readonly GAME_WIDTH = 640;
  readonly GAME_HEIGHT = 480;
  
  // Scaling and viewport offsets
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
  }

  async loadAssets(): Promise<void> {
    const assetNames = [
      'bgtile', 'clock', 'clock_hand', 'combo_meter', 'combo_liquid', 'combo_count',
      'floor01', 'floor02', 'floor03', 'floor04', 'floor05', 'floor06',
      'floor07', 'floor08', 'floor09', 'floor10', 'floor11', 'floor12',
      'hero000', 'hero001', 'hero002', 'hero003', 'hero004', 'hero005',
      'hero006', 'hero007', 'hero008', 'hero009', 'hero010', 'hero011',
      'hero012', 'hero013', 'hero014', 'heroface000',
      'reware000', 'reware001', 'reware002', 'reware003', 'reware004', 'reware005',
      'sideblock', 'sign01', 'sign02', 'sign03', 'sign04',
      'star01', 'star02', 'star03', 'star04', 'star05', 'star06', 'star07', 'star08',
      'title', 'title_bg', 'gameover'
    ];

    const promises = assetNames.map((name) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.src = `/assets/${name}.png`;
        img.onload = () => {
          this.images.set(name, img);
          resolve();
        };
        img.onerror = () => {
          console.warn(`Asset failed to load: /assets/${name}.png`);
          resolve();
        };
      });
    });

    await Promise.all(promises);
  }

  getImage(name: string): HTMLImageElement | undefined {
    return this.images.get(name);
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);

    // Compute scale so the 640x480 playfield fits nicely with generous space
    const scaleX = (w * dpr) / this.GAME_WIDTH;
    const scaleY = (h * dpr) / this.GAME_HEIGHT;
    this.scale = Math.min(scaleX, scaleY);

    // Center game viewport inside canvas
    this.offsetX = Math.floor(((w * dpr) - (this.GAME_WIDTH * this.scale)) / 2);
    this.offsetY = Math.floor(((h * dpr) - (this.GAME_HEIGHT * this.scale)) / 2);

    this.ctx.imageSmoothingEnabled = false;
  }

  spawnComboStars(centerX: number, centerY: number, count = 20): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 0,
        maxLife: 30 + Math.floor(Math.random() * 20),
        spriteIndex: Math.floor(Math.random() * 8) + 1
      });
    }
  }

  render(wasm: WasmPhysicsExports, gameState: 'title' | 'playing' | 'paused' | 'gameover', t: TranslationStrings): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const fullW = this.canvas.width;
    const fullH = this.canvas.height;

    ctx.save();
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, fullW, fullH);

    const bgtile = this.images.get('bgtile');
    const sideblock = this.images.get('sideblock');

    // 1. Fill entire background with scrolling tower stone tiles
    const cameraY = wasm.get_camera_y();
    if (bgtile) {
      const bgW = bgtile.width * this.scale;
      const bgH = bgtile.height * this.scale;
      const scrollY = ((-cameraY * 0.5 * this.scale) % bgH);

      ctx.save();
      for (let y = -bgH + scrollY; y < fullH + bgH; y += bgH) {
        for (let x = 0; x < fullW; x += bgW) {
          ctx.drawImage(bgtile, x, y, bgW + 1, bgH + 1);
        }
      }
      // Add subtle dark gradient overlay for depth
      const grad = ctx.createLinearGradient(0, 0, 0, fullH);
      grad.addColorStop(0, 'rgba(0, 5, 20, 0.45)');
      grad.addColorStop(1, 'rgba(0, 0, 10, 0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, fullW, fullH);
      ctx.restore();
    }

    // 2. Setup game view transformation
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Tower walls (Left wall at 0..85, Right wall at 555..640)
    if (sideblock) {
      const wallH = sideblock.height;
      const scrollY = ((-cameraY * this.scale) % wallH);
      
      // Draw left wall
      for (let y = -wallH + scrollY; y < this.GAME_HEIGHT + wallH; y += wallH) {
        ctx.drawImage(sideblock, -sideblock.width + 85, y);
      }
      // Draw right wall (flipped)
      for (let y = -wallH + scrollY; y < this.GAME_HEIGHT + wallH; y += wallH) {
        ctx.save();
        ctx.translate(555, y);
        ctx.scale(-1, 1);
        ctx.drawImage(sideblock, -sideblock.width, 0);
        ctx.restore();
      }
    }

    // 3. Render Platforms
    const platCount = wasm.get_platform_count();
    for (let i = 0; i < platCount; i++) {
      if (!wasm.get_platform_active(i)) continue;
      
      const floorNum = wasm.get_platform_floor(i);
      const platY = wasm.get_platform_y(i);
      const startTile = wasm.get_platform_start(i);
      const endTile = wasm.get_platform_end(i);
      const type = wasm.get_platform_type(i); // 0: ice, 1: wood, 2: cloud, 3: bone
      
      // Screen Y coordinate
      const screenY = platY - cameraY + 240;
      if (screenY < -50 || screenY > this.GAME_HEIGHT + 50) continue;

      // Select tile names based on theme
      let leftName = 'floor01';
      let midName = 'floor02';
      let rightName = 'floor03';
      if (type === 1) {
        leftName = 'floor04'; midName = 'floor05'; rightName = 'floor06';
      } else if (type === 2) {
        leftName = 'floor07'; midName = 'floor08'; rightName = 'floor09';
      } else if (type === 3) {
        leftName = 'floor10'; midName = 'floor11'; rightName = 'floor12';
      }

      const imgLeft = this.images.get(leftName);
      const imgMid = this.images.get(midName);
      const imgRight = this.images.get(rightName);

      const startX = startTile * 16;
      const endX = endTile * 16;

      // Left cap
      if (imgLeft) {
        ctx.drawImage(imgLeft, startX - (imgLeft.width - 16), screenY);
      }
      // Middle repeat tiles
      if (imgMid) {
        for (let x = startX + 16; x < endX - 16; x += 16) {
          ctx.drawImage(imgMid, x, screenY);
        }
      }
      // Right cap
      if (imgRight) {
        ctx.drawImage(imgRight, endX - 16, screenY);
      }

      // Draw floor milestone marker on special floors (50, 100, 150...)
      if (floorNum > 0 && floorNum % 50 === 0) {
        const signImg = this.images.get('sign01');
        const midX = (startX + endX) / 2;
        if (signImg) {
          ctx.drawImage(signImg, midX - signImg.width / 2, screenY - signImg.height - 2);
        }
        ctx.save();
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.fillText(`${floorNum}`, midX, screenY + 20);
        ctx.restore();
      }
    }

    // 4. Render Player (Harold the Homeboy)
    const px = wasm.get_player_x();
    const py = wasm.get_player_y();
    const vx = wasm.get_player_vx();
    const vy = wasm.get_player_vy();
    const state = wasm.get_player_state(); // 0: ground, 1: jump, 2: fall
    const facing = wasm.get_player_facing(); // 0: left, 1: right
    const spin = wasm.get_player_spin();
    const onEdge = wasm.get_player_on_edge();
    const animFrame = wasm.get_player_anim_frame();
    const isGameOver = wasm.get_game_over();

    let heroSpriteName = 'hero000';
    if (isGameOver) {
      heroSpriteName = 'hero012'; // splat
    } else if (state === 0) {
      if (Math.abs(vx) > 0.3) {
        const runSprites = ['hero001', 'hero002', 'hero003', 'hero004'];
        heroSpriteName = runSprites[animFrame % 4];
      } else if (onEdge) {
        heroSpriteName = (Math.floor(Date.now() / 200) % 2 === 0) ? 'hero013' : 'hero014';
      } else {
        heroSpriteName = 'hero000';
      }
    } else if (state === 1) { // jumping
      if (vy < -16) {
        heroSpriteName = 'hero008'; // super high jump stretch
      } else {
        heroSpriteName = 'hero006';
      }
    } else { // falling
      heroSpriteName = 'hero010';
    }

    const heroImg = this.images.get(heroSpriteName) || this.images.get('hero000');
    if (heroImg) {
      const pScreenX = px;
      const pScreenY = py - cameraY + 240;

      ctx.save();
      ctx.translate(pScreenX, pScreenY);

      // Spin rotation if in flip spin
      if (spin !== 0) {
        ctx.rotate(spin);
      }

      // Horizontal flip if facing left
      if (facing === 0) {
        ctx.scale(-1, 1);
      }

      // Draw centered horizontally, anchored at bottom foot
      ctx.drawImage(heroImg, -heroImg.width / 2, -heroImg.height);
      ctx.restore();
    }

    // 5. Render Combo Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // particle gravity
      p.life++;

      const starImg = this.images.get(`star0${p.spriteIndex}`);
      if (starImg) {
        const pScreenY = p.y - cameraY + 240;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.drawImage(starImg, p.x - starImg.width / 2, pScreenY - starImg.height / 2);
        ctx.restore();
      }

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // 6. Combo Meter & Liquid (Left HUD)
    const comboMeter = this.images.get('combo_meter');
    const comboLiquid = this.images.get('combo_liquid');
    const comboCount = this.images.get('combo_count');
    const comboTimer = wasm.get_combo_timer();
    const comboFloors = wasm.get_combo_floors();

    if (comboMeter) {
      const meterX = 14;
      const meterY = 140;
      ctx.drawImage(comboMeter, meterX, meterY);

      if (comboTimer > 0 && comboLiquid) {
        const fillHeight = (comboTimer / 100) * comboLiquid.height;
        const sourceY = comboLiquid.height - fillHeight;
        ctx.drawImage(
          comboLiquid,
          0, sourceY, comboLiquid.width, fillHeight,
          meterX + 16, meterY + 12 + sourceY, comboLiquid.width, fillHeight
        );
      }

      if (comboFloors >= 2 && comboCount) {
        ctx.drawImage(comboCount, meterX + 4, meterY - 45);
        ctx.save();
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffec40';
        ctx.shadowColor = '#d94000';
        ctx.shadowBlur = 6;
        ctx.textAlign = 'center';
        ctx.fillText(`x${comboFloors}`, meterX + 30, meterY - 14);
        ctx.restore();
      }
    }

    // 7. Hurry Up Clock (Top-left HUD)
    const clockImg = this.images.get('clock');
    const clockHand = this.images.get('clock_hand');
    if (clockImg && clockHand) {
      const clockX = 12;
      const clockY = 12;
      ctx.drawImage(clockImg, clockX, clockY);

      const clockTimer = wasm.get_clock_timer();
      const angle = (clockTimer * 0.04) % (Math.PI * 2);
      ctx.save();
      // Pivot center of clock
      ctx.translate(clockX + clockImg.width / 2, clockY + clockImg.height / 2);
      ctx.rotate(angle);
      ctx.drawImage(clockHand, -clockHand.width / 2, -clockHand.height + 6);
      ctx.restore();
    }

    // 8. Combo Celebration Banner (Center Screen)
    const bannerType = wasm.get_combo_banner_type();
    const bannerTimer = wasm.get_combo_banner_timer();
    if (bannerType >= 0 && bannerTimer > 0) {
      const bannerImg = this.images.get(`reware00${bannerType}`);
      if (bannerImg) {
        ctx.save();
        // Pop-in scale bounce
        const scaleFactor = bannerTimer > 70 ? 1 + (bannerTimer - 70) * 0.03 : 1;
        const bannerW = bannerImg.width * scaleFactor;
        const bannerH = bannerImg.height * scaleFactor;
        const bx = (this.GAME_WIDTH - bannerW) / 2;
        const by = 180 - bannerH / 2;

        ctx.shadowColor = '#ffe040';
        ctx.shadowBlur = 15;
        ctx.drawImage(bannerImg, bx, by, bannerW, bannerH);
        ctx.restore();
      }
    }

    // 9. Retro HUD (Score & Highest Floor)
    const currentFloor = wasm.get_current_floor();
    const score = wasm.get_score();

    ctx.save();
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${t.floor}: ${currentFloor}`, 110, 36);
    ctx.fillText(`${t.score}: ${score}`, 110, 62);
    ctx.restore();

    // 10. Title Screen Overlay
    if (gameState === 'title') {
      const titleImg = this.images.get('title');
      const titleBg = this.images.get('title_bg');

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

      if (titleImg) {
        ctx.drawImage(titleImg, (this.GAME_WIDTH - titleImg.width) / 2, 60);
      }

      ctx.font = 'bold 24px monospace';
      ctx.fillStyle = '#ffe040';
      ctx.shadowColor = '#d94000';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.fillText(t.pressKeyToStart, this.GAME_WIDTH / 2, 380);
      }

      ctx.font = '14px monospace';
      ctx.fillStyle = '#a0d0ff';
      ctx.shadowBlur = 2;
      ctx.fillText(t.mobileControlsPrompt, this.GAME_WIDTH / 2, 420);
      ctx.restore();
    }

    // 11. Game Over Overlay
    if (gameState === 'gameover' || isGameOver) {
      const gameOverImg = this.images.get('gameover');
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

      if (gameOverImg) {
        ctx.drawImage(gameOverImg, (this.GAME_WIDTH - gameOverImg.width) / 2, 100);
      }

      ctx.font = 'bold 26px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.textAlign = 'center';
      ctx.fillText(`${t.floor}: ${currentFloor}`, this.GAME_WIDTH / 2, 270);
      ctx.fillText(`${t.score}: ${score}`, this.GAME_WIDTH / 2, 310);

      ctx.fillStyle = '#ffe040';
      ctx.shadowColor = '#ff4000';
      ctx.fillText(t.restart, this.GAME_WIDTH / 2, 380);
      ctx.restore();
    }

    // 12. Paused Overlay
    if (gameState === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.GAME_WIDTH, this.GAME_HEIGHT);

      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#ffe040';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.fillText(t.pause, this.GAME_WIDTH / 2, 220);

      ctx.font = '18px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.resume, this.GAME_WIDTH / 2, 270);
      ctx.restore();
    }

    ctx.restore(); // restore game view
    ctx.restore(); // restore canvas
  }
}
