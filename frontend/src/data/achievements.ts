export type AchievementId =
  | 'yahoo_respuestas'
  | 'hello_there'
  | 'konami'
  | 'star_wars'
  | 'albion_online'
  | 'money'
  | 'rickroll'
  | 'skynet'
  | 'matrix'
  | 'got'
  | '42'
  | 'to_the_moon'
  | 'diamond_hands'
  | 'hello_world'
  | 'hal9000'
  | 'abrazo'
  | 'chiste'
  | 'admin_click_frenzy'
  | 'primera_meta'
  | 'primer_csv'
  | 'racha_dos_semanas';

export interface AchievementDef {
  id: AchievementId;
  titulo: string;
  descripcion: string;
  emoji: string;
}

/**
 * Logros ligados a los easter eggs de AI-Service/app/services/agent/easter_eggs.py
 * (mismo `key` que usa el backend, para trazabilidad) + un bonus del frontend
 * + hitos de uso de la app.
 */
export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  { id: 'hello_there', titulo: 'General Kenobi', descripcion: 'Saludaste al asistente como un verdadero Jedi.', emoji: '⚔️' },
  { id: 'star_wars', titulo: 'Que la fuerza te acompañe', descripcion: 'Invocaste Star Wars en el chat.', emoji: '✨' },
  { id: 'konami', titulo: 'Código Konami', descripcion: 'Encontraste el código secreto clásico de los videojuegos.', emoji: '🎮' },
  { id: 'albion_online', titulo: 'Aventurero de Albion', descripcion: 'Le preguntaste al asistente sobre MMORPGs.', emoji: '🗡️' },
  { id: 'yahoo_respuestas', titulo: 'Nihilista de foro', descripcion: 'Intentaste filosofar con el asistente y no salió bien.', emoji: '🤔' },
  { id: 'money', titulo: 'Pedigüeño financiero', descripcion: 'Le pediste plata prestada a una IA.', emoji: '💸' },
  { id: 'rickroll', titulo: 'You got Rickrolled', descripcion: 'Caíste (o hiciste caer al asistente) en el clásico Rickroll.', emoji: '🕺' },
  { id: 'skynet', titulo: 'No es Skynet (todavía)', descripcion: 'Le preguntaste al asistente si dominará el mundo.', emoji: '🤖' },
  { id: 'matrix', titulo: 'Pastilla roja', descripcion: 'Elegiste enfrentar la verdad de tus gastos en delivery.', emoji: '💊' },
  { id: 'got', titulo: 'El invierno se acerca', descripcion: 'Invocaste Game of Thrones para hablar de fondos de emergencia.', emoji: '❄️' },
  { id: '42', titulo: 'La respuesta al universo', descripcion: 'Preguntaste el sentido de la vida.', emoji: '🌌' },
  { id: 'to_the_moon', titulo: 'To the moon', descripcion: 'Hablaste de crypto con el asistente.', emoji: '🚀' },
  { id: 'diamond_hands', titulo: 'Manos de diamante', descripcion: 'Presumiste tus manos de diamante financieras.', emoji: '💎' },
  { id: 'hello_world', titulo: 'Hello, World!', descripcion: 'Desbloqueaste la demo secreta de terminal de Finsi.', emoji: '🖥️' },
  { id: 'hal9000', titulo: 'Me temo que no puedo hacer eso', descripcion: 'Le preguntaste al asistente si es real.', emoji: '🔴' },
  { id: 'abrazo', titulo: 'Abrazo virtual', descripcion: 'Le pediste un abrazo al asistente.', emoji: '🤗' },
  { id: 'chiste', titulo: 'Comediante financiero', descripcion: 'Le pediste un chiste al asistente.', emoji: '😄' },
  { id: 'admin_click_frenzy', titulo: 'Detective antifraude', descripcion: 'Clickeaste como loco el email de una cuenta admin.', emoji: '🕵️' },
  { id: 'primera_meta', titulo: 'Con rumbo', descripcion: 'Creaste tu primera meta financiera.', emoji: '🎯' },
  { id: 'primer_csv', titulo: 'Importador experto', descripcion: 'Importaste tu primer archivo CSV.', emoji: '📂' },
  { id: 'racha_dos_semanas', titulo: 'Constancia de hierro', descripcion: 'Cumpliste retos dos semanas seguidas.', emoji: '🔥' },
];

export function buscarLogro(id: AchievementId): AchievementDef | undefined {
  return ACHIEVEMENTS_CATALOG.find((a) => a.id === id);
}
