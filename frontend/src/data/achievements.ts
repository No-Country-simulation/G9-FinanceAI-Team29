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
  | 'mongolia'
  | 'wololo'
  | 'descanso'
  | 'isengard'
  | 'admin_click_frenzy'
  | 'primera_meta'
  | 'primer_csv'
  | 'racha_dos_semanas';

/** 'especial' = easter egg del chat (secreto, se descubre jugando con el asistente).
 *  'hito' = logro de uso normal de la app (crear una meta, importar un CSV, etc.). */
export type AchievementCategoria = 'especial' | 'hito';

export interface AchievementDef {
  id: AchievementId;
  titulo: string;
  descripcion: string;
  emoji: string;
  /** Imagen a usar en vez de `emoji` cuando el carácter unicode no tiene glifo confiable
   *  en todas las plataformas (p. ej. banderas de países en Windows/Android). */
  imagenUrl?: string;
  categoria: AchievementCategoria;
  /** Pista de cómo desbloquear el logro, se revela solo tras insistir clickeando el candado. */
  pista: string;
}

/**
 * Logros ligados a los easter eggs de AI-Service/app/services/agent/easter_eggs.py
 * (mismo `key` que usa el backend, para trazabilidad) + un bonus del frontend
 * + hitos de uso de la app.
 */
export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  { id: 'hello_there', titulo: 'General Kenobi', descripcion: 'Saludaste al asistente como un verdadero Jedi.', emoji: '⚔️', categoria: 'especial', pista: 'Saluda al asistente con un "Hello there" al estilo Star Wars.' },
  { id: 'star_wars', titulo: 'Que la fuerza te acompañe', descripcion: 'Invocaste Star Wars en el chat.', emoji: '✨', categoria: 'especial', pista: 'Menciona "Star Wars" o dile "que la fuerza te acompañe" en el chat.' },
  { id: 'konami', titulo: 'Código Konami', descripcion: 'Encontraste el código secreto clásico de los videojuegos.', emoji: '🎮', categoria: 'especial', pista: 'Prueba el clásico código Konami (arriba arriba abajo abajo izquierda derecha izquierda derecha B A) en el chat.' },
  { id: 'albion_online', titulo: 'Aventurero de Albion', descripcion: 'Le preguntaste al asistente sobre MMORPGs.', emoji: '🗡️', categoria: 'especial', pista: 'Pregúntale al asistente qué es un MMORPG o si conoce Albion Online.' },
  { id: 'yahoo_respuestas', titulo: 'Nihilista de foro', descripcion: 'Intentaste filosofar con el asistente y no salió bien.', emoji: '🤔', categoria: 'especial', pista: 'Intenta filosofar con el asistente sobre Nietzsche y el nihilismo.' },
  { id: 'money', titulo: 'Pedigüeño financiero', descripcion: 'Le pediste plata prestada a una IA.', emoji: '💸', categoria: 'especial', pista: 'Pídele dinero prestado al asistente en el chat.' },
  { id: 'rickroll', titulo: 'You got Rickrolled', descripcion: 'Caíste (o hiciste caer al asistente) en el clásico Rickroll.', emoji: '🕺', categoria: 'especial', pista: 'Dile al asistente "never gonna give you up" o "nunca te voy a abandonar".' },
  { id: 'skynet', titulo: 'No es Skynet (todavía)', descripcion: 'Le preguntaste al asistente si dominará el mundo.', emoji: '🤖', categoria: 'especial', pista: 'Pregúntale al asistente si es Skynet o si va a dominar el mundo.' },
  { id: 'matrix', titulo: 'Pastilla roja', descripcion: 'Elegiste enfrentar la verdad de tus gastos en delivery.', emoji: '💊', categoria: 'especial', pista: 'Ofrécele al asistente elegir entre la pastilla roja o la azul.' },
  { id: 'got', titulo: 'El invierno se acerca', descripcion: 'Invocaste Game of Thrones para hablar de fondos de emergencia.', emoji: '❄️', categoria: 'especial', pista: 'Dile "winter is coming" o "el invierno se acerca".' },
  { id: '42', titulo: 'La respuesta al universo', descripcion: 'Preguntaste el sentido de la vida.', emoji: '🌌', categoria: 'especial', pista: 'Pregúntale cuál es el sentido de la vida, el universo y todo lo demás.' },
  { id: 'to_the_moon', titulo: 'To the moon', descripcion: 'Hablaste de crypto con el asistente.', emoji: '🚀', categoria: 'especial', pista: 'Habla de criptomonedas: "to the moon" o "HODL".' },
  { id: 'diamond_hands', titulo: 'Manos de diamante', descripcion: 'Presumiste tus manos de diamante financieras.', emoji: '💎', categoria: 'especial', pista: 'Presume tus "manos de diamante" en el chat.' },
  { id: 'hello_world', titulo: 'Hello, World!', descripcion: 'Desbloqueaste la demo secreta de terminal de Finsi.', emoji: '🖥️', categoria: 'especial', pista: 'Escribe "Hello World" o "Hola mundo" en el chat.' },
  { id: 'hal9000', titulo: 'Me temo que no puedo hacer eso', descripcion: 'Le preguntaste al asistente si es real.', emoji: '🔴', categoria: 'especial', pista: 'Pregúntale al asistente si es una inteligencia artificial, un bot o un robot.' },
  { id: 'abrazo', titulo: 'Abrazo virtual', descripcion: 'Le pediste un abrazo al asistente.', emoji: '🤗', categoria: 'especial', pista: 'Pídele un abrazo al asistente.' },
  { id: 'chiste', titulo: 'Comediante financiero', descripcion: 'Le pediste un chiste al asistente.', emoji: '😄', categoria: 'especial', pista: 'Pídele al asistente que cuente un chiste.' },
  { id: 'wololo', titulo: 'Wololo', descripcion: 'Invocaste el wololo financiero.', emoji: 'WO', categoria: 'especial', pista: 'Escribe "wololo" en el chat.' },
  { id: 'descanso', titulo: 'Junto a la hoguera', descripcion: 'Le pediste un descanso al asistente.', emoji: 'OK', categoria: 'especial', pista: 'Dile al asistente que estas cansado o que necesitas descansar.' },
  { id: 'isengard', titulo: 'Camino a Isengard', descripcion: 'Encontraste una ruta muy poco financiera.', emoji: 'IG', categoria: 'especial', pista: 'Menciona Isengard o los hobbits en el chat.' },
  {
    id: 'mongolia',
    titulo: 'DE MONGOLIA SOY',
    descripcion: 'Despertaste el orgullo mongol del asistente.',
    emoji: '🇲🇳',
    // La bandera de Mongolia como emoji regional no tiene glifo en muchas fuentes de
    // Windows/Android y se ve como el texto "MN"; usamos la imagen real en su lugar.
    imagenUrl: 'https://images.emojiterra.com/google/noto-emoji/unicode-15/color/512px/1f1f2-1f1f3.png',
    categoria: 'especial',
    pista: 'Mencioná "Mongolia" (o "mongol") en el chat.',
  },
  { id: 'admin_click_frenzy', titulo: 'Detective antifraude', descripcion: 'Clickeaste como loco el email de una cuenta admin.', emoji: '🕵️', categoria: 'especial', pista: 'Haz clic varias veces seguidas en el correo de una cuenta administradora, en el selector de cuentas.' },
  { id: 'primera_meta', titulo: 'Con rumbo', descripcion: 'Creaste tu primera meta financiera.', emoji: '🎯', categoria: 'hito', pista: 'Crea tu primera meta financiera.' },
  { id: 'primer_csv', titulo: 'Importador experto', descripcion: 'Importaste tu primer archivo CSV.', emoji: '📂', categoria: 'hito', pista: 'Importa tu primer archivo CSV de movimientos.' },
  { id: 'racha_dos_semanas', titulo: 'Constancia de hierro', descripcion: 'Cumpliste retos dos semanas seguidas.', emoji: '🔥', categoria: 'hito', pista: 'Cumple tus retos diarios durante dos semanas seguidas.' },
];

export function buscarLogro(id: AchievementId): AchievementDef | undefined {
  return ACHIEVEMENTS_CATALOG.find((a) => a.id === id);
}
