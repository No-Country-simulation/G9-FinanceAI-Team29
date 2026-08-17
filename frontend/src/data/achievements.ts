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
  | 'pastilla_azul'
  | 'rastro_del_dinero'
  | 'intruso_matrix'
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
  | 'infinite_money'
  | 'ctrl_z_gastos'
  | 'finsi_walking'
  | 'admin_click_frenzy'
  | 'primera_meta'
  | 'primer_csv'
  | 'racha_dos_semanas'
  | 'meta_cumplida'
  | 'trivia_perfecta'
  | 'charlas_con_finsi'
  | 'meta_por_analisis'
  | 'tarea_calendario'
  | 'calendario_sincronizado'
  | 'filtro_imposible'
  | 'logro_persistente'
  | 'pregunta_finsi_contextual'
  | 'pregunta_economia'
  | 'equipo_descubierto'
  | 'narrador_activado'
  | 'narrador_desactivado'
  | 'coleccionista_secretos'
  | 'primer_analisis'
  | 'tour_completado'
  | 'exportar_pdf'
  | 'exportar_csv'
  | 'exportar_excel'
  | 'exportar_dashboard'
  |  'rey_crypto';

/**
 * 'especial' = easter egg del chat
 * (secreto, se descubre jugando con el asistente).
 *
 * 'hito' = logro de uso normal de la app
 * (crear una meta, importar un CSV, etc.).
 */
export type AchievementCategoria = 'especial' | 'hito';

export interface AchievementDef {
  id: AchievementId;
  titulo: string;
  descripcion: string;
  emoji: string;

  /**
   * Imagen a usar en vez de `emoji` cuando el carácter unicode
   * no tiene glifo confiable en todas las plataformas
   * (p. ej. banderas de países en Windows/Android).
   */
  imagenUrl?: string;

  categoria: AchievementCategoria;

  /**
   * Pista de cómo desbloquear el logro.
   * Se revela solo tras insistir clickeando el candado.
   */
  pista: string;
}

/**
 * Logros ligados a los easter eggs de
 * AI-Service/app/services/agent/easter_eggs.py
 * (mismo `key` que usa el backend, para trazabilidad)
 * + un bonus del frontend
 * + hitos de uso de la app.
 */
export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  {
    id: 'hello_there',
    titulo: 'General Kenobi',
    descripcion: 'Saludaste al asistente como un verdadero Jedi.',
    emoji: '⚔️',
    categoria: 'especial',
    pista: 'Saluda al asistente con un "Hello there" al estilo Star Wars.',
  },
  {
    id: 'star_wars',
    titulo: 'Que la fuerza te acompañe',
    descripcion: 'Invocaste Star Wars en el chat.',
    emoji: '✨',
    categoria: 'especial',
    pista: 'Menciona "Star Wars" o dile "que la fuerza te acompañe" en el chat.',
  },
  {
    id: 'konami',
    titulo: 'Código Konami',
    descripcion: 'Encontraste el código secreto clásico de los videojuegos.',
    emoji: '🎮',
    categoria: 'especial',
    pista:
      'Prueba el clásico código Konami (arriba arriba abajo abajo izquierda derecha izquierda derecha B A) en el chat.',
  },
  {
    id: 'albion_online',
    titulo: 'Aventurero de Albion',
    descripcion: 'Le preguntaste al asistente sobre MMORPGs.',
    emoji: '🗡️',
    categoria: 'especial',
    pista: 'Pregúntale al asistente qué es un MMORPG o si conoce Albion Online.',
  },
  {
    id: 'yahoo_respuestas',
    titulo: 'Nihilista de foro',
    descripcion: 'Intentaste filosofar con el asistente y no salió bien.',
    emoji: '🤔',
    categoria: 'especial',
    pista: 'Intenta filosofar con el asistente sobre Nietzsche y el nihilismo.',
  },
  {
    id: 'money',
    titulo: 'Pedigüeño financiero',
    descripcion: 'Le pediste plata prestada a una IA.',
    emoji: '💸',
    categoria: 'especial',
    pista: 'Pídele dinero prestado al asistente en el chat.',
  },
  {
    id: 'rickroll',
    titulo: 'You got Rickrolled',
    descripcion: 'Caíste (o hiciste caer al asistente) en el clásico Rickroll.',
    emoji: '🕺',
    categoria: 'especial',
    pista: 'Dile al asistente "never gonna give you up" o "nunca te voy a abandonar".',
  },
  {
    id: 'skynet',
    titulo: 'No es Skynet (todavía)',
    descripcion: 'Le preguntaste al asistente si dominará el mundo.',
    emoji: '🤖',
    categoria: 'especial',
    pista: 'Pregúntale al asistente si es Skynet o si va a dominar el mundo.',
  },
  {
    id: 'matrix',
    titulo: 'Pastilla roja',
    descripcion: 'Elegiste enfrentar la verdad de tus gastos en delivery.',
    emoji: '💊',
    imagenUrl: '/images/mascot/finsi_matrix_red.png',
    categoria: 'especial',
    pista: 'Ofrécele al asistente elegir entre la pastilla roja o la azul, y elegí la roja.',
  },
  {
    id: 'pastilla_azul',
    titulo: 'Pastilla azul',
    descripcion: 'Preferiste seguir creyendo lo que quieras creer sobre tus finanzas.',
    emoji: '🔵',
    imagenUrl: '/images/mascot/Finsight-bird-matrix-on.png',
    categoria: 'especial',
    pista: 'Ofrécele al asistente elegir entre la pastilla roja o la azul, y elegí la azul.',
  },
  {
    id: 'got',
    titulo: 'El invierno se acerca',
    descripcion: 'Invocaste Game of Thrones para hablar de fondos de emergencia.',
    emoji: '❄️',
    categoria: 'especial',
    pista: 'Dile "winter is coming" o "el invierno se acerca".',
  },
  {
    id: '42',
    titulo: 'La respuesta al universo',
    descripcion: 'Preguntaste el sentido de la vida.',
    emoji: '🌌',
    categoria: 'especial',
    pista: 'Pregúntale cuál es el sentido de la vida, el universo y todo lo demás.',
  },
  {
    id: 'to_the_moon',
    titulo: 'To the moon',
    descripcion: 'Hablaste de crypto con el asistente.',
    emoji: '🚀',
    categoria: 'especial',
    pista: 'Habla de criptomonedas: "to the moon" o "HODL".',
  },
  {
    id: 'diamond_hands',
    titulo: 'Manos de diamante',
    descripcion: 'Presumiste tus manos de diamante financieras.',
    emoji: '💎',
    categoria: 'especial',
    pista: 'Presume tus "manos de diamante" en el chat.',
  },
  {
    id: 'hello_world',
    titulo: 'Hello, World!',
    descripcion: 'Desbloqueaste la demo secreta de terminal de Finsi.',
    emoji: '🖥️',
    categoria: 'especial',
    pista: 'Escribe "Hello World" o "Hola mundo" en el chat.',
  },
  {
    id: 'hal9000',
    titulo: 'Me temo que no puedo hacer eso',
    descripcion: 'Le preguntaste al asistente si es real.',
    emoji: '🔴',
    categoria: 'especial',
    pista: 'Pregúntale al asistente si es una inteligencia artificial, un bot o un robot.',
  },
  {
    id: 'abrazo',
    titulo: 'Abrazo virtual',
    descripcion: 'Le pediste un abrazo al asistente.',
    emoji: '🤗',
    categoria: 'especial',
    pista: 'Pídele un abrazo al asistente.',
  },
  {
    id: 'chiste',
    titulo: 'Comediante financiero',
    descripcion: 'Le pediste un chiste al asistente.',
    emoji: '😄',
    categoria: 'especial',
    pista: 'Pídele al asistente que cuente un chiste.',
  },
  {
    id: 'wololo',
    titulo: 'Wololo',
    descripcion: 'Invocaste el wololo financiero.',
    emoji: '🔄',
    imagenUrl: '/images/mascot/wololo_icon.png',
    categoria: 'especial',
    pista: 'Escribe "wololo" en el chat.',
  },
  {
    id: 'descanso',
    titulo: 'Junto a la hoguera',
    descripcion: 'Le pediste un descanso al asistente.',
    emoji: '🔥',
    categoria: 'especial',
    pista: 'Dile al asistente que estás cansado o que necesitas descansar.',
  },
  {
    id: 'isengard',
    titulo: 'Camino a Isengard',
    descripcion: 'Encontraste una ruta muy poco financiera.',
    emoji: '🛡️',
    categoria: 'especial',
    pista: 'Menciona Isengard o los hobbits en el chat.',
  },
  {
    id: 'mongolia',
    titulo: 'DE MONGOLIA SOY',
    descripcion: 'Despertaste el orgullo mongol del asistente.',
    emoji: '🇲🇳',

    // La bandera de Mongolia como emoji regional no tiene glifo
    // en muchas fuentes de Windows/Android y se ve como el texto "MN";
    // usamos la imagen real en su lugar.
    imagenUrl:
      'https://images.emojiterra.com/google/noto-emoji/unicode-15/color/512px/1f1f2-1f1f3.png',

    categoria: 'especial',
    pista: 'Mencioná "Mongolia" (o "mongol") en el chat.',
  },

  // Nuevos easter eggs financieros
  {
    id: 'infinite_money',
    titulo: 'Dinero infinito',
    descripcion: 'Encontraste un glitch financiero demasiado bueno para durar.',
    emoji: '♾️',
    categoria: 'especial',
    pista: 'Prueba preguntarle al asistente por un "infinite money glitch".',
  },
  {
    id: 'ctrl_z_gastos',
    titulo: 'Ctrl+Z financiero',
    descripcion: 'Intentaste deshacer tus gastos como si la vida tuviera historial de cambios.',
    emoji: '⌨️',
    categoria: 'especial',
    pista: 'Intenta hacer Ctrl+Z sobre tus gastos en el chat.',
  },
  {
    id: 'finsi_walking',
    titulo: 'Con estilo',
    descripcion: 'Le preguntaste al asistente cómo conseguir mejores precios y Finsi se lució caminando la calle.',
    emoji: '🚶',
    categoria: 'especial',
    pista: 'Preguntale al asistente cómo conseguir mejores precios u ofertas.',
  },

  {
    id: 'admin_click_frenzy',
    titulo: 'Detective antifraude',
    descripcion: 'Clickeaste como loco el email de una cuenta admin.',
    emoji: '🕵️',
    categoria: 'especial',
    pista:
      'Haz clic varias veces seguidas en el correo de una cuenta administradora, en el selector de cuentas.',
  },

  // Hitos normales de uso
  {
    id: 'primera_meta',
    titulo: 'Con rumbo',
    descripcion: 'Creaste tu primera meta financiera.',
    emoji: '🎯',
    categoria: 'hito',
    pista: 'Crea tu primera meta financiera.',
  },
  {
    id: 'primer_csv',
    titulo: 'Importador experto',
    descripcion: 'Importaste tu primer archivo CSV.',
    emoji: '📂',
    categoria: 'hito',
    pista: 'Importa tu primer archivo CSV de movimientos.',
  },
  {
    id: 'racha_dos_semanas',
    titulo: 'Constancia de hierro',
    descripcion: 'Cumpliste retos dos semanas seguidas.',
    emoji: '🔥',
    categoria: 'hito',
    pista: 'Cumple tus retos diarios durante dos semanas seguidas.',
  },
  {
    id: 'meta_cumplida',
    titulo: 'Meta cumplida',
    descripcion: 'Completaste el 100% de una meta financiera.',
    emoji: '🏁',
    categoria: 'hito',
    pista: 'Ahorra hasta alcanzar el 100% de una de tus metas.',
  },
  {
    id: 'trivia_perfecta',
    titulo: 'Sabelotodo financiero',
    descripcion: 'Respondiste correctamente toda una ronda de trivia.',
    emoji: '🎓',
    categoria: 'hito',
    pista: 'Acertá las 5 preguntas de una misma ronda de trivia financiera.',
  },
  {
    id: 'charlas_con_finsi',
    titulo: 'Amigos de Finsi',
    descripcion: 'Hablaste 5 veces con el asistente Finsi.',
    emoji: '💬',
    categoria: 'hito',
    pista: 'Enviale 5 mensajes al asistente Finsi.',
  },
  {
    id: 'meta_por_analisis',
    titulo: 'Meta con propósito',
    descripcion: 'Creaste una meta a partir de las recomendaciones de tu análisis financiero.',
    emoji: '📈',
    categoria: 'hito',
    pista: 'Desde el resultado de un análisis, hacé clic en "Crear meta" y completá el formulario.',
  },
  {
    id: 'tarea_calendario',
    titulo: 'Organizador financiero',
    descripcion: 'Creaste tu primera tarea en el calendario financiero.',
    emoji: '🗓️',
    categoria: 'hito',
    pista: 'Agregá un evento nuevo en el calendario financiero.',
  },
  {
    id: 'calendario_sincronizado',
    titulo: 'Calendario conectado',
    descripcion: 'Sincronizaste el calendario financiero con tu app de calendario.',
    emoji: '🔗',
    categoria: 'hito',
    pista: 'Usá el botón para suscribirte al calendario desde Google o Apple Calendar.',
  },
  {
    id: 'filtro_imposible',
    titulo: 'JAJAJA, MR OBVIO',
    descripcion: 'Intentaste usar una combinación de filtros que no tiene ningún sentido.',
    emoji: '🤡',
    categoria: 'especial',
    pista: 'En Transacciones, hacé clic en una opción de filtro que esté bloqueada por el filtro contrario.',
  },
  {
    id: 'logro_persistente',
    titulo: 'Logro persistente',
    descripcion: 'Insististe clickeando un logro bloqueado hasta que Finsi te dio la pista completa.',
    emoji: '🔓',
    categoria: 'especial',
    pista: 'Hacé clic muchas veces sobre el candado de un logro bloqueado hasta que aparezca la pista.',
  },
  {
    id: 'pregunta_finsi_contextual',
    titulo: 'Con ayuda de Finsi',
    descripcion: 'Usaste el botón "Preguntar a Finsi sobre esto" para profundizar una recomendación.',
    emoji: '🙋',
    categoria: 'hito',
    pista: 'Buscá el botón "Preguntar a Finsi sobre esto" en una recomendación o evento del calendario.',
  },
  {
    id: 'pregunta_economia',
    titulo: 'Recién salido de la Facu',
    descripcion: 'Le hiciste al asistente tu primera pregunta de economía.',
    emoji: '📚',
    categoria: 'especial',
    pista: 'Hacele al asistente una pregunta sobre economía (inflación, tasas, mercado, etc.).',
  },
  {
    id: 'equipo_descubierto',
    titulo: 'Descubriste al equipo',
    descripcion: 'Le preguntaste al asistente quién lo creó y conociste a TwentyNineDevs.',
    emoji: '🕵️‍♂️',
    imagenUrl: 'https://media.tenor.com/jc9TgRwK5WYAAAAM/unmask.gif',
    categoria: 'especial',
    pista: 'Preguntale al asistente quién lo creó o quién es su equipo.',
  },
  {
    id: 'narrador_activado',
    titulo: 'ALOOO?',
    descripcion: 'Activaste por primera vez la voz narrada de Finsi.',
    emoji: '🔊',
    categoria: 'especial',
    pista: 'Activá la voz narrada en el chat con el asistente.',
  },
  {
    id: 'narrador_desactivado',
    titulo: 'SILENCIO!!',
    descripcion: 'Desactivaste por primera vez la voz narrada de Finsi.',
    emoji: '🤫',
    categoria: 'especial',
    pista: 'Después de activarla, desactivá la voz narrada en el chat con el asistente.',
  },
  {
    id: 'primer_analisis',
    titulo: 'Analista debutante',
    descripcion: 'Hiciste tu primer análisis financiero.',
    emoji: '🔍',
    categoria: 'hito',
    pista: 'Completá el formulario de Análisis y hacé clic en "Analizar Finanzas".',
  },
  {
    id: 'rastro_del_dinero',
    titulo: 'El rastro del dinero',
    descripcion: 'Seguiste a Finsi en Modo Matrix hasta ver tu resumen financiero.',
    emoji: '🐦',
    categoria: 'hito',
    pista: 'En Modo Matrix, pasá el mouse sobre la mascota y hacé clic en "Sí, vamos".',
  },
  {
    id: 'intruso_matrix',
    titulo: 'No estabas invitado',
    descripcion: 'Intentaste colarte en Modo Matrix sin elegir la pastilla roja, y la Matrix te lo hizo saber.',
    emoji: '🟢',
    imagenUrl: '/images/mascot/finsi_matrix_red.png',
    categoria: 'especial',
    pista: 'Intentá entrar a Modo Matrix sin haber elegido la pastilla roja antes (por ejemplo, recargando la página o volviendo con el botón "atrás").',
  },
  {
    id: 'tour_completado',
    titulo: 'Explorador guiado',
    descripcion: 'Completaste el recorrido de bienvenida de la app.',
    emoji: '🧭',
    categoria: 'hito',
    pista: 'Terminá el tour de bienvenida hasta el último paso.',
  },
  {
    id: 'exportar_pdf',
    titulo: 'Papel digital',
    descripcion: 'Exportaste un reporte en PDF.',
    emoji: '📄',
    categoria: 'hito',
    pista: 'Usá el botón "Exportar" y elegí la opción PDF.',
  },
  {
    id: 'exportar_csv',
    titulo: 'Datos en crudo',
    descripcion: 'Exportaste un reporte en CSV.',
    emoji: '🗂️',
    categoria: 'hito',
    pista: 'Usá el botón "Exportar" y elegí la opción CSV.',
  },
  {
    id: 'exportar_excel',
    titulo: 'Hoja de cálculo',
    descripcion: 'Exportaste un reporte en Excel.',
    emoji: '📊',
    categoria: 'hito',
    pista: 'Usá el botón "Exportar" y elegí la opción Excel.',
  },
  {
    id: 'exportar_dashboard',
    titulo: 'Panel de control',
    descripcion: 'Exportaste el dashboard financiero completo.',
    emoji: '🖨️',
    categoria: 'hito',
    pista: 'Usá el botón "Exportar" y elegí la opción "Exportar Dashboard".',
  },
  {
    id: 'rey_crypto',
    titulo: 'Rey de las Crypto',
    descripcion: 'Hablaste con el mismísimo Rey de las Crypto.',
    emoji: '👑',
    categoria: 'hito',
    pista: 'Pregúntale a Finsi sobre Bitcoin, criptomonedas o memecoins.',
  },

  {
    id: 'coleccionista_secretos',
    titulo: 'Coleccionista de secretos',
    descripcion: 'Desbloqueaste todos los easter eggs escondidos en el chat.',
    emoji: '🏆',
    categoria: 'hito',
    pista: 'Encontrá todos los logros especiales escondidos en el chat con el asistente.',
  },
];

export function buscarLogro(id: AchievementId): AchievementDef | undefined {
  return ACHIEVEMENTS_CATALOG.find((a) => a.id === id);
}