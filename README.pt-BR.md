<div align="center">

# icy-tower

**Engenharia reversa e port moderno para web (WebAssembly, HTML5 Canvas & TypeScript) do clássico _Icy Tower 1.0_ (Free Lunch Design, 2001)**

[![TypeScript](https://img.shields.io/badge/typescript-5.5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Status](https://img.shields.io/badge/status-playable-success)](#-progresso)
[![Fase](https://img.shields.io/badge/fase-pronto_para_produ%C3%A7%C3%A3o-blue)](#-progresso)
[![Plataformas](https://img.shields.io/badge/plataformas-Web_%7C_Vercel_%7C_Mobile-lightgrey)](#-como-jogar)
[![Licença: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)

_O clássico arcade da Free Lunch Design de 2001 criado por Johan Peitz,<br>recriado para rodar nativamente em qualquer navegador moderno, desktop e celular._

[English](README.md) · **Português**

</div>

---

## 🏰 Sobre

O **icy-tower** analisa o executável Windows original do _Icy Tower 1.0_ (`icytower.exe`) e os pacotes de dados (`data/data.dat`, `data/sfx_11.dat`) (Free Lunch Design, 2001) usando **REA** (Reverse Engineer Anything) e Ghidra para entender cada fórmula de física, curva de pulo, mecânica de quique na parede e sistema de pontuação, entregando uma implementação web limpa e autêntica.

Diferente de emuladores x86 pesados, este port roda nativamente em **WebAssembly**, **TypeScript** e **HTML5 Canvas** com **zero sobrecarga de emulação**:

- 🖥️ **Canvas 100% Tela Cheia e Responsivo**: Escalonamento de viewport dinâmico que ocupa 100% da largura e altura da tela. Centraliza a torre automaticamente e estende as paredes de tijolos e o fundo de pedras da torre sem barras pretas.
- 📱 **Mobile-Friendly e Pronto para Toque**: Otimizado para smartphones e tablets com botões virtuais retrô na tela (Esquerda, Direita e um botão de Pulo de alta resposta), gestos de toque (arrastar para cima para pular, toque para iniciar) e vibração háptica.
- ⚙️ **Física em WebAssembly**: Simulação principal escrita em C e compilada diretamente para WebAssembly (`icytower_physics.wasm`), rodando em passo fixo de 60 Hz com movimento sub-pixel exato, gravidade (`0.8`), curva de pulo proporcional à velocidade (`vy = -max(12, |2*vx|)`), quique de parede (`-0.9`) e giros acrobáticos.
- 🔊 **Áudio e Música com Web Audio API**: Reprodução de todos os 25 efeitos sonoros PCM de 11025 Hz originais (`jump_lo`, `jump_mid`, `jump_hi`, `step`, `edge`, `hurryup`, `falling`, `splat`) e trilhas de música em loop (`bg_beat.wav`, `bg_menu.wav`) com ativação por toque.
- 🎯 **Sistema Autêntico de Combos**: Medidor de combos em tempo real com líquido animado no HUD esquerdo. Banners comemorativos e estrelas para **Good!** (2–6 andares), **Sweet!** (7–14), **Great!** (15–24), **Wow!** (25–34), **Amazing!** (35–44) e **Extreme!** (45+ andares).
- 🌍 **Suporte Multilíngue (i18n)**: Suporte nativo a **Português do Brasil**, **English**, **Español**, **Deutsch** e **简体中文** com botão de alternância rápida.
- ⚡ **Pronto para Vercel**: Build ultra-rápido com Vite (<150ms) pronto para publicação na Vercel, GitHub Pages ou qualquer hospedagem estática moderna.

---

## 📊 Progresso

| Área | Status | Detalhes |
|---|:---:|---|
| **Engenharia Reversa** | ✅ | Análise estática do `icytower.exe` com REA MCP & Ghidra |
| **Extração de Recursos** | ✅ | Descompressão dos pacotes LZSS Allegro (`data.dat`, `sfx_11.dat`), extraídos 63 PNGs e 25 WAVs |
| **Simulação WebAssembly** | ✅ | Motor de física em C compilado para `icytower_physics.wasm` via `clang --target=wasm32` |
| **Física e Curvas de Salto** | ✅ | Aceleração horizontal (`0.3`), quique de parede (`-0.9`) e pulo proporcional à velocidade |
| **Renderizador Canvas 2D** | ✅ | Layout 100% tela cheia, fundo da torre em paralaxe, pisos autênticos e partículas |
| **Sistema de Combos** | ✅ | Medidor de combo animado com líquido, multiplicador, banners e pontuação bônus |
| **Motor Web Audio** | ✅ | Gerenciador Web Audio com desbloqueio no primeiro toque, efeitos e música |
| **Controles Móveis Touch** | ✅ | Botões virtuais na tela, gestos de deslizar e vibração háptica |
| **Localização (i18n)** | ✅ | 5 idiomas completos: PT-BR, EN, ES, DE, ZH-CN |
| **Vercel & PWA** | ✅ | Build estático pronto com cabeçalhos otimizados (`vercel.json`) |

---

## 🎮 Controles

### Teclado no Computador
| Tecla | Ação |
|---|---|
| <kbd>←</kbd> / <kbd>A</kbd> | Correr para a Esquerda |
| <kbd>→</kbd> / <kbd>D</kbd> | Correr para a Direita |
| <kbd>Espaço</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> | Pular / Iniciar / Reiniciar |
| <kbd>P</kbd> / <kbd>Esc</kbd> | Pausar / Continuar |
| <kbd>Enter</kbd> | Iniciar Jogo |

### Toque no Celular
| Gesto / Toque | Ação |
|---|---|
| **Botão ◀** | Mover para a Esquerda |
| **Botão ▶** | Mover para a Direita |
| **Botão JUMP** | Pular (segure enquanto corre para pulos gigantes) |
| **Tocar na Tela** | Pular / Iniciar / Reiniciar |
| **Deslizar para Cima** | Pulo Rápido |
| **Botões Superiores** | Tela cheia (`⤢`), Som (`🔊`), Idioma (`PT`/`EN`) |

---

## 🚀 Como Jogar

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18 ou superior)
- `npm`

### Desenvolvimento Local
```bash
# Clone o repositório
git clone https://github.com/pedryvo/icy-tower.git
cd icy-tower

# Instale as dependências
npm install

# Inicie o servidor Vite
npm run dev
```

Abra o navegador em `http://localhost:3000` para jogar imediatamente!

### Compilação de Produção
```bash
# Gerar arquivos estáticos otimizados
npm run build
```

Os arquivos prontos serão gerados na pasta `dist/`.

### Publicando na Vercel
Você pode fazer deploy diretamente com a CLI da Vercel:
```bash
# Instalar CLI da Vercel (opcional)
npm i -g vercel

# Publicar
vercel
```
Ou importar o repositório `pedryvo/icy-tower` diretamente no [Painel da Vercel](https://vercel.com/new).

---

## 🔬 Metodologia de Engenharia Reversa

1. **Análise Estática e Descompilação Ghidra**: `icytower.exe` (PE x86) foi analisado através do servidor MCP **REA** (Reverse Engineer Anything). Funções-chave recuperadas:
   - `FUN_00406670`: Física do jogador, limite de velocidade, colisão e quique nas paredes laterais (`x > 555` ou `x < 85` $\rightarrow$ `vx = -vx * 0.9`), gravidade (`vy += 0.8`).
   - `FUN_00406800`: Cálculo do impulso do pulo proporcional à velocidade de corrida: `vy = -max(12.0, |2 * vx|)`.
   - `FUN_00402670`: Controles de entrada com amortecimento por atrito (`vx *= 0.9`) e tração de curva (`vx *= 0.7`).
   - `FUN_00404ff0`: Gerador procedural de andares (`rand() % max_len + 6`) e troca de temas a cada 100 andares.
   - `FUN_004024f0`: Limiares dos anúncios de combos (Good < 7, Sweet < 15, Great < 25, Wow < 35, Amazing < 45, Extreme 45+).
2. **Descompressão de Arquivos**: Os arquivos `.dat` do Allegro 4 foram descompactados usando um algoritmo LZSS com buffer inicializado em zeros (`text_buf = 0`), idêntico à implementação do Allegro.
3. **WebAssembly**: O núcleo de física foi reescrito em C puro (`src/wasm/physics.c`) e compilado com `clang --target=wasm32 -nostdlib -O3`, garantindo simulação determinística de alta performance.
4. **Interface Web**: Motor Canvas 2D responsivo em tela cheia com controles virtuais para toque e áudio via Web Audio API.

---

## ⚖️ Aviso Legal

_Icy Tower_ é copyright © 2001 Free Lunch Design e Johan Peitz.

Este é um projeto não comercial, educacional e de fãs para fins de preservação e interoperabilidade. Não possui qualquer vínculo comercial com a Free Lunch Design.

O código fonte deste projeto é licenciado sob a [GNU General Public License v3.0](LICENSE).
