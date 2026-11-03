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
  private cylindricalBg: HTMLCanvasElement | null = null;
  
  // Logical game resolution
  readonly GAME_WIDTH = 640;
  readonly GAME_HEIGHT = 480;
  
  // Dynamic viewport dimensions in logical pixels (fills 100% height on mobile!)
  private viewWidth = 640;
  private viewHeight = 480;
  private cameraX = 0;

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
    this.buildCylindricalBackground();
  }

  /**
   * Reconstructs the exact 640x64 3D cylindrical brick tower texture
   * from FUN_00401db0 in icytower.exe:
   * - Staggered brick courses (row 0 offset by 32px, row 1 offset by 0px)
   * - Bricks foreshorten horizontally as they wrap toward the walls: w = 64 - (offset >> 2)
   * - Cylindrical shading gradient darkens toward the left (x=75) and right (x=565) walls
   */
  private buildCylindricalBackground(): void {
    const bgtile = this.images.get('bgtile');
    if (!bgtile) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = 640;
    offscreen.height = 64;
    const octx = offscreen.getContext('2d');
    if (!octx) return;
    octx.imageSmoothingEnabled = false;

    for (let row = 0; row < 2; row++) {
      const y = row * 32;
      let offset = row === 0 ? 32 : 0;

      // Center brick on row 0 (spans 288..352)
      if (row === 0) {
        octx.drawImage(bgtile, 0, 0, 64, 32, 320 - 32, y, 64, 32);
      }

      while (offset < 320) {
        const w = Math.max(8, 64 - (offset >> 2));
        // Right side of tower cylinder
        octx.drawImage(bgtile, 0, 0, 64, 32, 320 + offset, y, w, 32);
        // Left side of tower cylinder
        octx.drawImage(bgtile, 0, 0, 64, 32, 320 - offset - w, y, w, 32);
        offset += w;
      }
    }

    // Apply cylindrical 3D shadow ramp across x = 0..640 (matching FUN_00401db0 palette ramp)
    for (let x = 0; x < 640; x++) {
      const dist = Math.abs(x - 320) / 255; // 0 at center, ~1.0 at walls (x=65..575)
      const curve = Math.min(1, dist * dist * 0.85 + dist * 0.15);
      const alpha = 0.08 + curve * 0.76;
      octx.fillStyle = `rgba(4, 6, 18, ${alpha.toFixed(3)})`;
      octx.fillRect(x, 0, 1, 64);
    }

    this.cylindricalBg = offscreen;
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

    const aspect = w / h;

    if (aspect >= this.GAME_WIDTH / this.GAME_HEIGHT) {
      // Desktop / Landscape: fit 100% of screen height (480 logical px tall)
      this.viewHeight = this.GAME_HEIGHT;
      this.viewWidth = this.GAME_WIDTH;
      this.scale = (h * dpr) / this.GAME_HEIGHT;
      this.offsetX = Math.floor(((w * dpr) - (this.GAME_WIDTH * this.scale)) / 2);
      this.offsetY = 0;
    } else {
      // Mobile / Portrait / Narrow screen:
      // Eliminate 4:3 letterboxing! Zoom in so character & platforms are >2x larger
      // and extend viewHeight to occupy 100% of the vertical screen height.
      this.viewWidth = Math.min(this.GAME_WIDTH, Math.max(300, Math.round(520 * aspect)));
      this.scale = (w * dpr) / this.viewWidth;
      this.viewHeight = Math.max(this.GAME_HEIGHT, Math.round((h * dpr) / this.scale));
      this.offsetX = 0;
      this.offsetY = 0;
    }

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

  private drawRoundedBadge(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    bgColorTop: string,
    bgColorBottom: string,
    borderColor: string,
    shadowColor: string
  ): void {
    const ctx = this.ctx;
    ctx.save();
    
    // Drop shadow
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Draw background
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
    } else {
      ctx.rect(x, y, w, h);
    }

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, bgColorTop);
    grad.addColorStop(1, bgColorBottom);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.shadowBlur = 4;
    ctx.lineWidth = 2;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Inner highlight reflection line
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x + 2, y + 2, w - 4, Math.floor(h * 0.4), [radius - 2, radius - 2, 0, 0]);
    } else {
      ctx.rect(x + 2, y + 2, w - 4, Math.floor(h * 0.4));
    }
    const highlightGrad = ctx.createLinearGradient(x, y + 2, x, y + Math.floor(h * 0.4));
    highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.fillStyle = highlightGrad;
    ctx.fill();

    ctx.restore();
  }

  render(
    wasm: WasmPhysicsExports,
    gameState: 'title' | 'playing' | 'paused' | 'gameover',
    t: TranslationStrings,
    highScore = 0
  ): void {
    const ctx = this.ctx;
    const fullW = this.canvas.width;
    const fullH = this.canvas.height;

    ctx.save();
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, fullW, fullH);

    const bgtile = this.images.get('bgtile');
    const sideblock = this.images.get('sideblock');

    // Single integer camera Y per frame to prevent any sub-pixel jitter between platforms and player
    const camY = Math.round(wasm.get_camera_y());
    const px = wasm.get_player_x();
    const py = wasm.get_player_y();
    const isNarrow = this.viewWidth < this.GAME_WIDTH;

    // Vertical anchor: on tall mobile portrait screens, anchor Floor 0 above the touch controls
    // while showing all upper floors up to the very top of the screen (100% height)
    const anchorY = this.viewHeight > 500 ? this.viewHeight - 285 : 240;

    // Horizontal camera follow on mobile portrait / narrow screens
    if (!isNarrow) {
      this.cameraX = 0;
    } else {
      // Find next platform slightly above player to gently bias look-ahead
      let lookTargetX = px;
      const platCount = wasm.get_platform_count();
      let bestDy = 9999;
      for (let i = 0; i < platCount; i++) {
        if (!wasm.get_platform_active(i)) continue;
        const pY = wasm.get_platform_y(i);
        const dy = py - pY;
        if (dy > 10 && dy < 120 && dy < bestDy) {
          const st = wasm.get_platform_start(i);
          const en = wasm.get_platform_end(i);
          if (st > 0) {
            bestDy = dy;
            const platCenterX = ((st + en + 1) * 16) / 2;
            lookTargetX = px * 0.72 + platCenterX * 0.28;
          }
        }
      }
      const desiredCamX = lookTargetX - this.viewWidth / 2;
      const minCamX = Math.max(0, 50);
      const maxCamX = Math.max(minCamX, 590 - this.viewWidth);
      const clampedTarget = Math.max(minCamX, Math.min(maxCamX, desiredCamX));
      if (this.cameraX === 0) {
        this.cameraX = clampedTarget;
      } else {
        this.cameraX += (clampedTarget - this.cameraX) * 0.18;
      }
    }
    const camX = Math.round(this.cameraX);

    // 1. Fill outer widescreen backdrop with darkened staggered tower bricks
    if (bgtile && this.offsetX > 0) {
      const bgW = Math.max(1, Math.round(bgtile.width * this.scale));
      const bgH = Math.max(1, Math.round(bgtile.height * this.scale));
      const rawScroll = Math.round(-camY * 0.5 * this.scale) % (bgH * 2);
      const scrollY = rawScroll > 0 ? rawScroll - bgH * 2 : rawScroll;

      ctx.save();
      let rowIdx = 0;
      for (let y = scrollY; y < fullH + bgH; y += bgH) {
        const stagger = (rowIdx & 1) ? Math.round(bgW / 2) : 0;
        for (let x = -stagger; x < fullW + bgW; x += bgW) {
          ctx.drawImage(bgtile, x, y, bgW, bgH);
        }
        rowIdx++;
      }
      ctx.fillStyle = 'rgba(4, 6, 16, 0.72)';
      ctx.fillRect(0, 0, fullW, fullH);
      ctx.restore();
    }

    // 2. Setup logical game viewport transformation (occupies 100% height on mobile & desktop)
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Clip to logical viewport
    ctx.beginPath();
    ctx.rect(0, 0, this.viewWidth, this.viewHeight);
    ctx.clip();

    // 2a. World-space layer (panned by -camX on mobile portrait)
    ctx.save();
    ctx.translate(-camX, 0);

    // Render authentic 3D cylindrical brick background (FUN_00401db0) across full viewHeight
    if (this.cylindricalBg) {
      const cylH = 64;
      const bgScroll = (((-Math.floor(camY * 0.5)) % cylH) + cylH) % cylH - cylH;
      for (let y = bgScroll; y < this.viewHeight + cylH; y += cylH) {
        ctx.drawImage(this.cylindricalBg, 0, y);
      }
    }

    // 3. Render Platforms (FUN_00402780: 3-part cap/middle/cap system)
    const platCount = wasm.get_platform_count();
    for (let i = 0; i < platCount; i++) {
      if (!wasm.get_platform_active(i)) continue;

      const platY = wasm.get_platform_y(i);
      const screenY = Math.round(platY) - camY + anchorY;
      if (screenY < -50 || screenY > this.viewHeight + 50) continue;

      const startTile = wasm.get_platform_start(i);
      const endTile = wasm.get_platform_end(i);
      const floorType = wasm.get_platform_type(i);
      const floorNum = wasm.get_platform_floor(i);

      // 4 themes (0..3), each theme has 3 sprites: Left Cap, Middle Tile, Right Cap
      const theme = Math.abs(floorType) % 4;
      const leftIdx = theme * 3 + 1;
      const midIdx = theme * 3 + 2;
      const rightIdx = theme * 3 + 3;
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

      const imgLeft = this.images.get(`floor${pad(leftIdx)}`) || this.images.get('floor01');
      const imgMid = this.images.get(`floor${pad(midIdx)}`) || this.images.get('floor02');
      const imgRight = this.images.get(`floor${pad(rightIdx)}`) || this.images.get('floor03');

      const drawY = screenY - 6;

      // Left cap (21px wide, starts at startTile * 16 - 5 and ends at (startTile + 1) * 16)
      if (imgLeft) {
        ctx.drawImage(imgLeft, startTile * 16 - 5, drawY);
      }

      // Middle tiles (16px wide, from startTile + 1 to endTile - 1)
      if (imgMid) {
        for (let t = startTile + 1; t < endTile; t++) {
          ctx.drawImage(imgMid, t * 16, drawY);
        }
      }

      // Right cap (21px wide, starts at endTile * 16)
      if (imgRight) {
        ctx.drawImage(imgRight, endTile * 16, drawY);
      }

      // Draw milestone floor sign on every 10th floor (FUN_00402780)
      if (floorNum > 0 && floorNum % 10 === 0) {
        const signImg = this.images.get(`sign0${theme + 1}`) || this.images.get('sign01');
        // On full-width 50th floors, place the sign near the center/left so it's always visible
        const signCenterX = (startTile === 0)
          ? 200
          : Math.floor(((startTile + endTile + 1) * 16) / 2);
        const signY = screenY + 5;
        if (signImg) {
          ctx.drawImage(signImg, Math.floor(signCenterX - signImg.width / 2), signY);
        }
        ctx.save();
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 3;
        ctx.textAlign = 'center';
        ctx.fillText(`${floorNum}`, signCenterX, signY + 18);
        ctx.restore();
      }
    }

    // 4. Render Side Walls AFTER platforms so full-width floors tuck under the walls (FUN_00402780 @ 0x402f5b)
    if (sideblock) {
      const wallH = sideblock.height; // 124
      const wallScroll = (((-camY) % wallH) + wallH) % wallH - wallH;

      // Left Wall: horizontally flipped at x = -57..75 (rounded stone border faces right at x = 75)
      ctx.save();
      ctx.translate(75, 0);
      ctx.scale(-1, 1);
      for (let y = wallScroll; y < this.viewHeight + wallH; y += wallH) {
        ctx.drawImage(sideblock, 0, y);
      }
      ctx.restore();

      // Right Wall: unflipped at x = 565..697 (rounded stone border faces left at x = 565)
      for (let y = wallScroll; y < this.viewHeight + wallH; y += wallH) {
        ctx.drawImage(sideblock, 565, y);
      }
    }

    // 5. Render Player (Harold the Homeboy - exact sprite mapping from FUN_00402780)
    const vx = wasm.get_player_vx();
    const vy = wasm.get_player_vy();
    const state = wasm.get_player_state(); // 0: ground, 1: jump, 2: fall
    const facing = wasm.get_player_facing(); // 0: left, 1: right
    const spin = wasm.get_player_spin();
    const onEdge = wasm.get_player_on_edge();
    const animFrame = wasm.get_player_anim_frame();
    const animTimer = wasm.get_player_anim_timer ? wasm.get_player_anim_timer() : 0;
    const isGameOver = wasm.get_game_over();

    let heroSpriteName = 'hero000';
    if (isGameOver || spin !== 0) {
      heroSpriteName = 'hero012'; // star-jump / rotation sprite (44x60)
    } else if (state === 0) {
      if (Math.abs(vx) > 0.25) {
        const runSprites = ['hero001', 'hero002', 'hero003', 'hero004'];
        heroSpriteName = runSprites[animFrame % 4];
      } else if (onEdge) {
        heroSpriteName = (Math.floor(animTimer / 8) % 2 === 0) ? 'hero013' : 'hero014';
      } else {
        heroSpriteName = 'hero000';
      }
    } else {
      // Airborne (jumping or falling)
      if (Math.abs(vx) < 0.25) {
        // Vertical jump / vertical fall
        heroSpriteName = vy < 0 ? 'hero008' : 'hero011';
      } else {
        // Diagonal jump / apex / fall
        if (vy < -3.0) {
          heroSpriteName = 'hero005';
        } else if (vy <= 3.0) {
          heroSpriteName = 'hero006';
        } else {
          heroSpriteName = 'hero007';
        }
      }
    }

    const heroImg = this.images.get(heroSpriteName) || this.images.get('hero000');
    if (heroImg) {
      const pScreenX = Math.round(px);
      const pScreenY = Math.round(py) - camY + anchorY;

      ctx.save();
      if (spin !== 0) {
        // Rotate around Harold's torso center
        ctx.translate(pScreenX, pScreenY - 26);
        ctx.rotate(spin);
        if (facing === 0) {
          ctx.scale(-1, 1);
        }
        ctx.drawImage(heroImg, -Math.floor(heroImg.width / 2), -Math.floor(heroImg.height / 2));
      } else {
        ctx.translate(pScreenX, pScreenY);
        if (facing === 0) {
          ctx.scale(-1, 1);
        }
        // Use integer offset (-14 horizontally, -heroImg.height + 1 vertically)
        // so feet rest solidly on the 3D platform top surface with zero sub-pixel jitter
        const drawX = onEdge ? -18 : -14;
        const drawY = -heroImg.height + 1;
        ctx.drawImage(heroImg, drawX, drawY);
      }
      ctx.restore();
    }

    // 6. Render Combo Particles (world-space)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // particle gravity
      p.life++;

      const starImg = this.images.get(`star0${p.spriteIndex}`);
      if (starImg) {
        const pScreenY = Math.round(p.y) - camY + anchorY;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.drawImage(starImg, Math.round(p.x - starImg.width / 2), Math.round(pScreenY - starImg.height / 2));
        ctx.restore();
      }

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    ctx.restore(); // End world-space (-camX) layer; now in viewport-space (0..viewWidth, 0..viewHeight)

    // 7. Combo Meter & Liquid (Left HUD)
    const comboMeter = this.images.get('combo_meter');
    const comboLiquid = this.images.get('combo_liquid');
    const comboCount = this.images.get('combo_count');
    const comboTimer = wasm.get_combo_timer();
    const comboFloors = wasm.get_combo_floors();

    if (comboMeter) {
      const meterX = isNarrow ? 6 : 14;
      const meterY = isNarrow ? 105 : 140;
      const meterScale = isNarrow ? 0.78 : 1;

      ctx.save();
      ctx.translate(meterX, meterY);
      ctx.scale(meterScale, meterScale);
      ctx.drawImage(comboMeter, 0, 0);

      if (comboTimer > 0 && comboLiquid) {
        const fillHeight = (comboTimer / 100) * comboLiquid.height;
        const sourceY = comboLiquid.height - fillHeight;
        ctx.drawImage(
          comboLiquid,
          0, sourceY, comboLiquid.width, fillHeight,
          16, 12 + sourceY, comboLiquid.width, fillHeight
        );
      }

      if (comboFloors >= 2 && comboCount) {
        ctx.drawImage(comboCount, 4, -45);
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffec40';
        ctx.shadowColor = '#d94000';
        ctx.shadowBlur = 6;
        ctx.textAlign = 'center';
        ctx.fillText(`x${comboFloors}`, 30, -14);
      }
      ctx.restore();
    }

    // 8. Hurry Up Clock (Top-left HUD)
    const clockImg = this.images.get('clock');
    const clockHand = this.images.get('clock_hand');
    if (clockImg && clockHand) {
      const clockScale = isNarrow ? 0.56 : 1;
      const clockX = isNarrow ? 6 : 12;
      const clockY = isNarrow ? 42 : 12;

      ctx.save();
      ctx.translate(clockX, clockY);
      ctx.scale(clockScale, clockScale);
      ctx.drawImage(clockImg, 0, 0);

      const clockTimer = wasm.get_clock_timer();
      const angle = (clockTimer * 0.04) % (Math.PI * 2);
      ctx.translate(clockImg.width / 2, clockImg.height / 2);
      ctx.rotate(angle);
      ctx.drawImage(clockHand, -clockHand.width / 2, -clockHand.height + 6);
      ctx.restore();
    }

    // 9. Combo Celebration Banner (Center Screen)
    const bannerType = wasm.get_combo_banner_type();
    const bannerTimer = wasm.get_combo_banner_timer();
    if (bannerType >= 0 && bannerTimer > 0) {
      const bannerImg = this.images.get(`reware00${bannerType}`);
      if (bannerImg) {
        ctx.save();
        const maxBannerW = this.viewWidth * 0.82;
        const baseScale = Math.min(1, maxBannerW / bannerImg.width);
        const scaleFactor = (bannerTimer > 70 ? 1 + (bannerTimer - 70) * 0.03 : 1) * baseScale;
        const bannerW = bannerImg.width * scaleFactor;
        const bannerH = bannerImg.height * scaleFactor;
        const bx = (this.viewWidth - bannerW) / 2;
        const by = this.viewHeight * 0.34 - bannerH / 2;

        ctx.shadowColor = '#ffe040';
        ctx.shadowBlur = 15;
        ctx.drawImage(bannerImg, bx, by, bannerW, bannerH);
        ctx.restore();
      }
    }

    // 10. REFINED RETRO ARCADE HUD (Andar / Pontos / Recorde)
    const currentFloor = wasm.get_current_floor();
    const score = wasm.get_score();

    if (isNarrow) {
      // Compact mobile HUD layout (fits 100% inside narrow portrait width right below top-right controls)
      const hudStartX = 62;
      const hudY = 44;
      const hudH = 44;
      const gap = 5;
      const availW = this.viewWidth - hudStartX - 6;
      const badgeW = Math.floor((availW - gap * 2) / 3);

      // Floor Badge
      const fx = hudStartX;
      this.drawRoundedBadge(
        fx, hudY, badgeW, hudH, 6,
        'rgba(24, 20, 8, 0.90)', 'rgba(12, 10, 4, 0.95)',
        '#f5b800', 'rgba(245, 184, 0, 0.4)'
      );
      ctx.save();
      ctx.font = '900 9px sans-serif';
      ctx.fillStyle = '#ffcf33';
      ctx.textAlign = 'center';
      ctx.fillText(`▲ ${t.floor.toUpperCase()}`, fx + badgeW / 2, hudY + 14);
      ctx.font = '900 16px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${currentFloor}`, fx + badgeW / 2, hudY + 35);
      ctx.restore();

      // Score Badge
      const sx = fx + badgeW + gap;
      this.drawRoundedBadge(
        sx, hudY, badgeW, hudH, 6,
        'rgba(6, 22, 28, 0.90)', 'rgba(3, 12, 16, 0.95)',
        '#00d4e6', 'rgba(0, 212, 230, 0.4)'
      );
      ctx.save();
      ctx.font = '900 9px sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'center';
      ctx.fillText(`★ ${t.score.toUpperCase()}`, sx + badgeW / 2, hudY + 14);
      ctx.font = '900 15px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${score.toLocaleString()}`, sx + badgeW / 2, hudY + 35);
      ctx.restore();

      // Best Badge
      const bx = sx + badgeW + gap;
      this.drawRoundedBadge(
        bx, hudY, badgeW, hudH, 6,
        'rgba(26, 12, 26, 0.90)', 'rgba(14, 6, 14, 0.95)',
        '#e056b3', 'rgba(224, 86, 179, 0.4)'
      );
      ctx.save();
      ctx.font = '900 9px sans-serif';
      ctx.fillStyle = '#ff78c8';
      ctx.textAlign = 'center';
      ctx.fillText(`👑 ${t.best.toUpperCase()}`, bx + badgeW / 2, hudY + 14);
      ctx.font = '900 14px "Courier New", monospace';
      ctx.fillStyle = '#ffe8f5';
      ctx.fillText(`${Math.max(highScore, score).toLocaleString()}`, bx + badgeW / 2, hudY + 35);
      ctx.restore();
    } else {
      // Desktop HUD Badges
      this.drawRoundedBadge(
        112, 12, 138, 56, 8,
        'rgba(24, 20, 8, 0.90)', 'rgba(12, 10, 4, 0.95)',
        '#f5b800', 'rgba(245, 184, 0, 0.45)'
      );

      ctx.save();
      ctx.font = '900 11px sans-serif';
      ctx.fillStyle = '#ffcf33';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.textAlign = 'center';
      ctx.fillText(`▲ ${t.floor.toUpperCase()}`, 112 + 138 / 2, 28);

      ctx.font = '900 24px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#e69500';
      ctx.shadowBlur = 6;
      ctx.fillText(`${currentFloor}`, 112 + 138 / 2, 55);
      ctx.restore();

      this.drawRoundedBadge(
        260, 12, 155, 56, 8,
        'rgba(6, 22, 28, 0.90)', 'rgba(3, 12, 16, 0.95)',
        '#00d4e6', 'rgba(0, 212, 230, 0.45)'
      );

      ctx.save();
      ctx.font = '900 11px sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.textAlign = 'center';
      ctx.fillText(`★ ${t.score.toUpperCase()}`, 260 + 155 / 2, 28);

      ctx.font = '900 22px "Courier New", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#008cb3';
      ctx.shadowBlur = 6;
      ctx.fillText(`${score.toLocaleString()}`, 260 + 155 / 2, 55);
      ctx.restore();

      this.drawRoundedBadge(
        425, 12, 125, 56, 8,
        'rgba(26, 12, 26, 0.90)', 'rgba(14, 6, 14, 0.95)',
        '#e056b3', 'rgba(224, 86, 179, 0.45)'
      );

      ctx.save();
      ctx.font = '900 11px sans-serif';
      ctx.fillStyle = '#ff78c8';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.textAlign = 'center';
      ctx.fillText(`👑 ${t.best.toUpperCase()}`, 425 + 125 / 2, 28);

      ctx.font = '900 19px "Courier New", monospace';
      ctx.fillStyle = '#ffe8f5';
      ctx.shadowColor = '#aa2277';
      ctx.shadowBlur = 6;
      ctx.fillText(`${Math.max(highScore, score).toLocaleString()}`, 425 + 125 / 2, 54);
      ctx.restore();
    }

    // 11. Title Screen Overlay
    if (gameState === 'title') {
      const titleImg = this.images.get('title');

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

      const centerY = Math.floor(this.viewHeight * 0.42);

      if (titleImg) {
        const maxLogoW = this.viewWidth - 24;
        const logoScale = Math.min(1, maxLogoW / titleImg.width);
        const lw = Math.round(titleImg.width * logoScale);
        const lh = Math.round(titleImg.height * logoScale);
        ctx.drawImage(titleImg, Math.round((this.viewWidth - lw) / 2), Math.max(80, centerY - lh - 10), lw, lh);
      }

      // Best Score Banner on Title
      if (highScore > 0) {
        const bw = Math.min(240, this.viewWidth - 32);
        this.drawRoundedBadge(
          (this.viewWidth - bw) / 2, centerY + 10, bw, 40, 8,
          'rgba(26, 12, 26, 0.92)', 'rgba(14, 6, 14, 0.95)',
          '#e056b3', 'rgba(224, 86, 179, 0.5)'
        );
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillStyle = '#ffd6f0';
        ctx.textAlign = 'center';
        ctx.fillText(`👑 ${t.best.toUpperCase()}: ${highScore.toLocaleString()}`, this.viewWidth / 2, centerY + 35);
      }

      ctx.font = `bold ${isNarrow ? 15 : 22}px "Courier New", monospace`;
      ctx.fillStyle = '#ffe040';
      ctx.shadowColor = '#d94000';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.fillText(t.pressKeyToStart, this.viewWidth / 2, centerY + 85);
      }

      ctx.font = `${isNarrow ? 10 : 13}px monospace`;
      ctx.fillStyle = '#a0d0ff';
      ctx.shadowBlur = 2;
      ctx.fillText(t.mobileControlsPrompt, this.viewWidth / 2, centerY + 120);
      ctx.restore();
    }

    // 12. Game Over Overlay
    if (gameState === 'gameover' || isGameOver) {
      const gameOverImg = this.images.get('gameover');
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

      const centerY = Math.floor(this.viewHeight * 0.44);

      if (gameOverImg) {
        const maxGoW = this.viewWidth - 28;
        const goScale = Math.min(1, maxGoW / gameOverImg.width);
        const gw = Math.round(gameOverImg.width * goScale);
        const gh = Math.round(gameOverImg.height * goScale);
        ctx.drawImage(gameOverImg, Math.round((this.viewWidth - gw) / 2), Math.max(70, centerY - gh - 25), gw, gh);
      }

      // Summary Card
      const cardW = Math.min(320, this.viewWidth - 28);
      const cardH = 135;
      const cardX = (this.viewWidth - cardW) / 2;
      const cardY = centerY - 10;
      this.drawRoundedBadge(
        cardX, cardY, cardW, cardH, 12,
        'rgba(16, 18, 32, 0.95)', 'rgba(8, 9, 18, 0.98)',
        '#ffe040', 'rgba(255, 224, 64, 0.4)'
      );

      ctx.textAlign = 'center';
      ctx.font = `bold ${isNarrow ? 17 : 20}px "Courier New", monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${t.floor}: ${currentFloor}`, this.viewWidth / 2, cardY + 42);
      ctx.fillText(`${t.score}: ${score.toLocaleString()}`, this.viewWidth / 2, cardY + 76);

      if (score >= highScore && score > 0) {
        ctx.font = `bold ${isNarrow ? 12 : 15}px "Courier New", monospace`;
        ctx.fillStyle = '#ff78c8';
        ctx.fillText(`🎉 NEW RECORD / NOVO RECORDE! 🎉`, this.viewWidth / 2, cardY + 112);
      } else {
        ctx.font = '14px "Courier New", monospace';
        ctx.fillStyle = '#a0c0e0';
        ctx.fillText(`${t.best}: ${highScore.toLocaleString()}`, this.viewWidth / 2, cardY + 112);
      }

      ctx.font = `bold ${isNarrow ? 15 : 22}px "Courier New", monospace`;
      ctx.fillStyle = '#ffe040';
      ctx.shadowColor = '#ff4000';
      ctx.shadowBlur = 8;
      const blink = Math.floor(Date.now() / 350) % 2 === 0;
      if (blink) {
        ctx.fillText(t.restart, this.viewWidth / 2, cardY + 170);
      }
      ctx.restore();
    }

    // 13. Paused Overlay
    if (gameState === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

      ctx.font = `bold ${isNarrow ? 28 : 36}px monospace`;
      ctx.fillStyle = '#ffe040';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.fillText(t.pause, this.viewWidth / 2, this.viewHeight * 0.44);

      ctx.font = `${isNarrow ? 14 : 18}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.resume, this.viewWidth / 2, this.viewHeight * 0.44 + 45);
      ctx.restore();
    }

    ctx.restore(); // restore game view
    ctx.restore(); // restore canvas
  }
}
