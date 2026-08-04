const CARAS = [
  '😀', '😁', '😂', '😅', '😉', '😊', '😎', '🤓',
  '🥳', '🤠', '🥸', '🤩', '😇', '🙃', '😴', '🤔',
];

// Emojis de un solo carácter (sin combinaciones ZWJ): en Windows las
// combinaciones tipo "persona + objeto" (ej. 🧑‍💻) no siempre se renderizan
// como un solo ícono y se ven las dos partes por separado.
const PERSONAS = [
  '🧑', '👨', '👩', '🧔', '👴', '👵', '🤴', '👸',
  '🥷', '🦸', '🦹', '🧙', '🧚', '🧛', '🧟', '🎅',
];

const ANIMALES = [
  '🐱', '🐶', '🦊', '🐼', '🦁', '🐨', '🐸', '🦉',
  '🐧', '🐢', '🐺', '🐯', '🐮', '🐷', '🐵', '🦄',
  '🐰', '🐹', '🦝', '🦔', '🐙', '🦋', '🐝', '🦖',
];

const OBJETOS = [
  '🚀', '⚡', '🎯', '💡', '🎧', '📚', '🎨', '⚽',
  '🎮', '🎸', '📷', '🔥', '🌟', '🌈', '🍀', '🌵',
  '☕', '🍕', '🎬', '⚓', '🛹', '🧩', '🏆', '💎',
];

export const AVATAR_OPTIONS = [
  ...CARAS,
  ...PERSONAS,
  ...ANIMALES,
  ...OBJETOS,
] as const;
