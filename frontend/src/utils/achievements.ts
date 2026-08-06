import type { AchievementId } from '../data/achievements';

/** Debe coincidir exactamente con el marcador del easter egg "hello_world" en el backend. */
const MARCADOR_TERMINAL_DEMO = '[[finsi-terminal-demo]]';

/**
 * Cada respuesta de EasterEggResponder.match (AI-Service/app/services/agent/easter_eggs.py)
 * es un texto fijo y determinístico (no pasa por el LLM), así que matchear un substring
 * único de cada una es una forma confiable de saber qué easter egg respondió el backend,
 * sin necesitar que la API exponga ese dato.
 */
const MATCHERS: { id: AchievementId; substring: string }[] = [
  { id: 'hello_there', substring: 'general kenobi' },
  { id: 'star_wars', substring: 'there is no try' },
  { id: 'konami', substring: 'código konami detectado' },
  { id: 'albion_online', substring: 'mmorpg no lineal' },
  { id: 'yahoo_respuestas', substring: 'pa k kieres saber eso' },
  { id: 'money', substring: 'ojalá pudiera' },
  { id: 'rickroll', substring: 'rickrolled' },
  { id: 'skynet', substring: 'domino el mundo, solo tus finanzas' },
  { id: 'matrix', substring: 'cuánto gastás en delivery' },
  { id: 'got', substring: 'invierno se acerca' },
  { id: 'to_the_moon', substring: 'to the moon' },
  { id: 'diamond_hands', substring: 'manos de diamante' },
  { id: 'hal9000', substring: 'no puedo hacer eso, dave' },
  { id: 'abrazo', substring: 'abrazo virtual' },
  { id: 'chiste', substring: 'dinero nunca duerme' },
];

export function detectarLogroEnRespuesta(answer: string): AchievementId | null {
  if (!answer) return null;

  if (answer.includes(MARCADOR_TERMINAL_DEMO)) return 'hello_world';
  if (answer.trim() === '42.') return '42';

  const normalizada = answer.toLowerCase();
  const encontrado = MATCHERS.find((m) => normalizada.includes(m.substring));
  return encontrado ? encontrado.id : null;
}
