<div align="center">

# icy-tower

**Reverse engineering and modern web port (WebAssembly, HTML5 Canvas & TypeScript) of _Icy Tower 1.0_ (Free Lunch Design, 2001)**

[![TypeScript](https://img.shields.io/badge/typescript-5.5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/status-playable-success)](#-progress)
[![Phase](https://img.shields.io/badge/phase-production_ready-blue)](#-progress)
[![Platforms](https://img.shields.io/badge/platforms-Web_%7C_Vercel_%7C_Mobile-lightgrey)](#-running-the-game)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)

_The 2001 Free Lunch Design arcade classic by Johan Peitz,<br>re-engineered to run natively in any modern browser, desktop, and mobile phone._

**English** · [Português](README.pt-BR.md)

</div>

---

## 🏰 About

**icy-tower** studies the original _Icy Tower 1.0_ Windows executable (`icytower.exe`) and data archives (`data/data.dat`, `data/sfx_11.dat`) (Free Lunch Design, 2001) using **REA** (Reverse Engineer Anything) and Ghidra to understand every physics formula, jump curve, wall bounce mechanic, and scoring system, delivering an authentic, clean web implementation.

Unlike heavyweight x86 emulators, this port runs natively in **WebAssembly**, **TypeScript**, and **HTML5 Canvas** with **zero emulation overhead**:

- 🖥️ **100% Fullscreen Responsive Canvas**: Dynamic viewport scaling that occupies 100% of the screen width and height. Automatically centers the tower and seamlessly tiles the authentic retro background and side brick walls to fill ultra-wide and portrait screens with zero letterbox dead space.
- 📱 **Mobile-Friendly & Touch-Ready**: Optimized for smartphones and tablets with on-screen virtual retro buttons (Left, Right, and a large tactile Jump button), touch swipe gestures (swipe up to jump, tap to start), and haptic vibration feedback.
- ⚙️ **WebAssembly Core Physics Engine**: Core simulation written in C and compiled directly to WebAssembly (`icytower_physics.wasm`), executing at a fixed 60 Hz timestep with exact sub-pixel movement, gravity (`0.8`), jump velocity curves (`vy = -max(12, |2*vx|)`), wall bounce restitution (`-0.9`), and spinning flips.
- 🔊 **Web Audio Sound & Music**: Direct playback of all 25 original 11025 Hz PCM `.wav` sound effects (`jump_lo`, `jump_mid`, `jump_hi`, `step`, `edge`, `hurryup`, `falling`, `splat`) and looping background music tracks (`bg_beat.wav`, `bg_menu.wav`) with user-gesture unlocking and mute toggles.
- 🎯 **Full Authentic Combo System**: Real-time combo tracker and animated liquid meter on the left HUD. Triggers celebration announcements and star particle bursts for **Good!** (2–6 floors), **Sweet!** (7–14), **Great!** (15–24), **Wow!** (25–34), **Amazing!** (35–44), and **Extreme!** (45+ floors).
- 🌍 **Multi-Language Support (i18n)**: Built-in support for **English**, **Português do Brasil**, **Español**, **Deutsch**, and **简体中文** with a live language switcher button.
- ⚡ **Instant Vercel Deployment**: Ultra-fast Vite build (<150ms) ready for one-click deployment to Vercel, GitHub Pages, or any modern edge hosting.

---

## 📊 Progress

| Area | Status | Details |
|---|:---:|---|
| **Reverse Engineering** | ✅ | Static analysis of `icytower.exe` using REA MCP & Ghidra |
| **Asset Extraction** | ✅ | Decompressed Allegro LZSS packfiles (`data.dat`, `sfx_11.dat`), extracted 63 PNGs and 25 WAVs |
| **WebAssembly Simulation** | ✅ | C-based physics engine compiled to `icytower_physics.wasm` via `clang --target=wasm32` |
| **Physics & Jump Curves** | ✅ | Exact match of horizontal acceleration (`0.3`), wall bounce (`-0.9`), and speed-scaled jump velocity |
| **Canvas 2D Renderer** | ✅ | 100% fullscreen responsive layout, parallax tower background, platform endcaps, star particles |
| **Combo System** | ✅ | Animated combo meter, liquid fill level, multiplier display, reward banners, and score bonuses |
| **Web Audio Engine** | ✅ | AudioContext loader with gesture unlock, sound effects, and looping background music |
| **Mobile Virtual Controls** | ✅ | On-screen touch D-Pad, Jump button, swipe gestures, and vibration haptics |
| **Localization (i18n)** | ✅ | 5 full languages supported: EN, PT-BR, ES, DE, ZH-CN |
| **Vercel & PWA Ready** | ✅ | Static build with optimized headers (`vercel.json`) |

---

## 🎮 Controls

### Desktop Keyboard
| Key | Action |
|---|---|
| <kbd>←</kbd> / <kbd>A</kbd> | Run Left |
| <kbd>→</kbd> / <kbd>D</kbd> | Run Right |
| <kbd>Space</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> | Jump / Start / Restart |
| <kbd>P</kbd> / <kbd>Esc</kbd> | Pause / Resume |
| <kbd>Enter</kbd> | Start Game |

### Mobile Touch
| Touch Action | Result |
|---|---|
| **◀ Button** | Move Left |
| **▶ Button** | Move Right |
| **JUMP Button** | Jump (hold while running for huge jumps) |
| **Tap Screen** | Jump / Start Game / Restart |
| **Swipe Up** | Quick Jump |
| **Top-Right Buttons** | Fullscreen (`⤢`), Audio (`🔊`), Language (`EN`/`PT`) |

---

## 🚀 Running the Game

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Local Development
```bash
# Clone the repository
git clone https://github.com/pedryvo/icy-tower.git
cd icy-tower

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:3000` to play immediately!

### Production Build
```bash
# Build optimized static distribution
npm run build
```

The output files will be in `dist/`, ready to be uploaded to any static web host.

### Deploying to Vercel
You can deploy this repository to Vercel with zero configuration:
```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
vercel
```
Or import `pedryvo/icy-tower` directly on the [Vercel Dashboard](https://vercel.com/new).

---

## 🔬 Reverse Engineering Methodology

1. **Static Analysis & Ghidra Decompilation**: `icytower.exe` (PE x86) was analyzed via the **REA** (Reverse Engineer Anything) MCP server. Key routines recovered:
   - `FUN_00406670`: Player physics, horizontal velocity clamping, wall collision bounce (`x > 555` or `x < 85` $\rightarrow$ `vx = -vx * 0.9`), and gravity (`vy += 0.8`).
   - `FUN_00406800`: Jump initiation logic where vertical impulse scales dynamically with horizontal speed: `vy = -max(12.0, |2 * vx|)`.
   - `FUN_00402670`: Input handling with friction damping (`vx *= 0.9`) and turnaround traction (`vx *= 0.7`).
   - `FUN_00404ff0`: Procedural platform generator (`rand() % max_len + 6`) and theme shifting every 100 floors.
   - `FUN_004024f0`: Combo announcer thresholds (Good < 7, Sweet < 15, Great < 25, Wow < 35, Amazing < 45, Extreme 45+).
2. **Container Analysis**: Allegro 4 `.dat` files were decompressed using custom LZSS unpackers initialized with null bytes (`text_buf = 0`, matching Allegro's `_pack_fdopen`).
3. **WebAssembly Compilation**: The core physics loop was ported to standalone C (`src/wasm/physics.c`) and compiled to WebAssembly using `clang --target=wasm32 -nostdlib -O3`, providing fast, deterministic simulation.
4. **Clean Web UI**: Fullscreen Canvas 2D engine with mobile on-screen controls, Web Audio API sound subsystem, and localized user interface.

---

## ⚖️ Legal Notice

_Icy Tower_ is copyright © 2001 Free Lunch Design and Johan Peitz.

This is an open-source non-profit educational fan project developed for preservation and interoperability. This project is not affiliated with or endorsed by Free Lunch Design.

The source code is licensed under the [GNU General Public License v3.0](LICENSE).
