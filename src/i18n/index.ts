export type Language = 'en' | 'pt-BR' | 'es' | 'de' | 'zh-CN';

export interface TranslationStrings {
  title: string;
  start: string;
  pause: string;
  resume: string;
  restart: string;
  gameOver: string;
  floor: string;
  score: string;
  best: string;
  combo: string;
  hurryUp: string;
  pressKeyToStart: string;
  mobileControlsPrompt: string;
  sound: string;
  music: string;
  instructions: string;
  instructionsText: string;
}

const translations: Record<Language, TranslationStrings> = {
  en: {
    title: 'Icy Tower 1.0 Web Port',
    start: 'START GAME',
    pause: 'PAUSED',
    resume: 'RESUME',
    restart: 'TRY AGAIN',
    gameOver: 'GAME OVER',
    floor: 'Floor',
    score: 'Score',
    best: 'Best',
    combo: 'Combo',
    hurryUp: 'HURRY UP!',
    pressKeyToStart: 'Press SPACE or Tap to Start',
    mobileControlsPrompt: 'Touch / On-Screen controls available',
    sound: 'Sound',
    music: 'Music',
    instructions: 'Instructions',
    instructionsText: 'Arrow Left/Right to run. Space/Up to jump. Run fast to build momentum and jump higher! Bounce off walls to perform super spin jumps!'
  },
  'pt-BR': {
    title: 'Icy Tower 1.0 Port Web',
    start: 'INICIAR JOGO',
    pause: 'PAUSADO',
    resume: 'CONTINUAR',
    restart: 'TENTAR DE NOVO',
    gameOver: 'FIM DE JOGO',
    floor: 'Andar',
    score: 'Pontos',
    best: 'Recorde',
    combo: 'Combo',
    hurryUp: 'RÁPIDO!',
    pressKeyToStart: 'Pressione ESPAÇO ou Toque para Iniciar',
    mobileControlsPrompt: 'Controles de toque na tela disponíveis',
    sound: 'Som',
    music: 'Música',
    instructions: 'Instruções',
    instructionsText: 'Setas Esquerda/Direita para correr. Espaço/Cima para pular. Corra rápido para pegar impulso e pular mais alto! Quique nas paredes para giros incríveis!'
  },
  es: {
    title: 'Icy Tower 1.0 Port Web',
    start: 'INICIAR JUEGO',
    pause: 'PAUSADO',
    resume: 'CONTINUAR',
    restart: 'REINTENTAR',
    gameOver: 'JUEGO TERMINADO',
    floor: 'Piso',
    score: 'Puntuación',
    best: 'Récord',
    combo: 'Combo',
    hurryUp: '¡RÁPIDO!',
    pressKeyToStart: 'Presiona ESPACIO o Toca para Comenzar',
    mobileControlsPrompt: 'Controles táctiles disponibles',
    sound: 'Sonido',
    music: 'Música',
    instructions: 'Instrucciones',
    instructionsText: 'Flechas Izquierda/Derecha para correr. Espacio/Arriba para saltar. ¡Corre rápido para tomar impulso y saltar más alto! ¡Rebota en las paredes!'
  },
  de: {
    title: 'Icy Tower 1.0 Web-Portierung',
    start: 'SPIEL STARTEN',
    pause: 'PAUSE',
    resume: 'WEITER',
    restart: 'NOCHMAL',
    gameOver: 'SPIEL VORBEI',
    floor: 'Stockwerk',
    score: 'Punkte',
    best: 'Bestwert',
    combo: 'Kombo',
    hurryUp: 'BEEILUNG!',
    pressKeyToStart: 'LEERTASTE oder Tippen zum Starten',
    mobileControlsPrompt: 'Touch-Steuerung verfügbar',
    sound: 'Ton',
    music: 'Musik',
    instructions: 'Anleitung',
    instructionsText: 'Pfeiltasten Links/Rechts zum Laufen. Leertaste/Oben zum Springen. Nimm Schwung für Riesen-Sprünge und Wand-Flips!'
  },
  'zh-CN': {
    title: '冰塔 1.0 网页移植版',
    start: '开始游戏',
    pause: '已暂停',
    resume: '继续',
    restart: '重试',
    gameOver: '游戏结束',
    floor: '层数',
    score: '得分',
    best: '最高分',
    combo: '连击',
    hurryUp: '抓紧时间！',
    pressKeyToStart: '按 空格 或 点击屏幕 开始',
    mobileControlsPrompt: '支持屏幕触摸虚拟按键',
    sound: '音效',
    music: '音乐',
    instructions: '玩法说明',
    instructionsText: '左右方向键移动，空格键跳跃。奔跑加速可以跳得更高！在墙壁反弹做出超级空中翻转！'
  }
};

export function getSystemLanguage(): Language {
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('pt')) return 'pt-BR';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('zh')) return 'zh-CN';
  return 'en';
}

export function getTranslations(lang: Language = getSystemLanguage()): TranslationStrings {
  return translations[lang] || translations.en;
}
