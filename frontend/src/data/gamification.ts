export type ChallengeKind =
  | 'gasto_bajo_promedio'
  | 'evitar_categoria_top'
  | 'registrar_ingreso_o_ahorro'
  | 'avanzar_meta';

export interface ChallengeTemplate {
  id: ChallengeKind;
  kind: ChallengeKind;
  titulo: string;
  descripcion: string;
}

export const CHALLENGE_CATALOG: ChallengeTemplate[] = [
  {
    id: 'gasto_bajo_promedio',
    kind: 'gasto_bajo_promedio',
    titulo: 'Semana bajo control',
    descripcion: 'Mantén tus gastos de la semana por debajo de tu promedio semanal habitual.',
  },
  {
    id: 'evitar_categoria_top',
    kind: 'evitar_categoria_top',
    titulo: 'Pausa en tu categoría top',
    descripcion: 'Pasa la semana sin registrar gastos en tu categoría de mayor gasto histórico.',
  },
  {
    id: 'registrar_ingreso_o_ahorro',
    kind: 'registrar_ingreso_o_ahorro',
    titulo: 'Suma un ingreso',
    descripcion: 'Registra al menos un ingreso durante la semana.',
  },
  {
    id: 'avanzar_meta',
    kind: 'avanzar_meta',
    titulo: 'Empuja una meta',
    descripcion: 'Haz avanzar el progreso de una meta activa al menos 5 puntos esta semana.',
  },
];

export type TriviaCategory = 'general' | 'personalizada';

export interface TriviaQuestion {
  id: string;
  categoria: TriviaCategory;
  pregunta: string;
  opciones: string[];
  respuestaCorrecta: number;
}

export const TRIVIA_QUESTIONS_GENERAL: TriviaQuestion[] = [
  {
    id: 'g1',
    categoria: 'general',
    pregunta: '¿Qué es un "fondo de emergencia"?',
    opciones: [
      'Un ahorro para cubrir gastos imprevistos',
      'Un préstamo bancario de corto plazo',
      'Un tipo de tarjeta de crédito',
      'Un seguro obligatorio',
    ],
    respuestaCorrecta: 0,
  },
  {
    id: 'g2',
    categoria: 'general',
    pregunta: '¿Cuál es la regla general recomendada para el fondo de emergencia?',
    opciones: [
      '1 semana de gastos',
      '3 a 6 meses de gastos',
      '2 años de gastos',
      'No es necesario tener uno',
    ],
    respuestaCorrecta: 1,
  },
  {
    id: 'g3',
    categoria: 'general',
    pregunta: '¿Qué significa "diversificar" una inversión?',
    opciones: [
      'Invertir todo en un solo activo',
      'Repartir el dinero entre distintos activos para reducir el riesgo',
      'Pedir un préstamo para invertir más',
      'Vender todas las inversiones al mismo tiempo',
    ],
    respuestaCorrecta: 1,
  },
  {
    id: 'g4',
    categoria: 'general',
    pregunta: '¿Qué es el interés compuesto?',
    opciones: [
      'Un interés que se cobra una sola vez',
      'Un interés que se calcula solo sobre el capital inicial',
      'Un interés que se calcula sobre el capital más los intereses acumulados',
      'Un impuesto bancario',
    ],
    respuestaCorrecta: 2,
  },
  {
    id: 'g5',
    categoria: 'general',
    pregunta: '¿Qué indica un alto "nivel de endeudamiento"?',
    opciones: [
      'Que tienes mucho dinero ahorrado',
      'Que una gran parte de tu ingreso se destina a pagar deudas',
      'Que no tienes ninguna deuda',
      'Que tus gastos son muy bajos',
    ],
    respuestaCorrecta: 1,
  },
  {
    id: 'g6',
    categoria: 'general',
    pregunta: '¿Qué es un presupuesto (budget)?',
    opciones: [
      'Un plan de ingresos y gastos para un período',
      'Un tipo de cuenta bancaria',
      'Un impuesto sobre el ahorro',
      'Un contrato de préstamo',
    ],
    respuestaCorrecta: 0,
  },
  {
    id: 'g7',
    categoria: 'general',
    pregunta: '¿Cuál de estas es una deuda considerada generalmente "buena"?',
    opciones: [
      'Un préstamo para educación que aumenta tu capacidad de ingreso',
      'Deuda de tarjeta de crédito sin pagar por meses',
      'Un préstamo para gastos superfluos',
      'Ninguna deuda es buena',
    ],
    respuestaCorrecta: 0,
  },
  {
    id: 'g8',
    categoria: 'general',
    pregunta: '¿Qué significa "gasto recurrente"?',
    opciones: [
      'Un gasto que ocurre una sola vez',
      'Un gasto que se repite periódicamente (ej. suscripciones, alquiler)',
      'Un gasto imprevisto',
      'Un tipo de inversión',
    ],
    respuestaCorrecta: 1,
  },
  {
    id: 'g9',
    categoria: 'general',
    pregunta: 'Si tus gastos superan tus ingresos de forma sostenida, ¿qué pasa?',
    opciones: [
      'Aumenta tu ahorro',
      'Se genera un déficit y aumenta el riesgo de endeudarte',
      'No pasa nada',
      'Mejora tu perfil financiero automáticamente',
    ],
    respuestaCorrecta: 1,
  },
  {
    id: 'g10',
    categoria: 'general',
    pregunta: '¿Qué es la "regla 50/30/20" en finanzas personales?',
    opciones: [
      'Una forma de repartir el ingreso entre necesidades, deseos y ahorro/deuda',
      'Una tasa de interés fija',
      'Un tipo de impuesto',
      'Una calificación crediticia',
    ],
    respuestaCorrecta: 0,
  },
  {
    id: 'g11',
    categoria: 'general',
    pregunta: '¿Por qué es útil registrar todas tus transacciones?',
    opciones: [
      'Para tener un historial visual de gastos, sin utilidad práctica',
      'Para identificar patrones y mejorar decisiones financieras',
      'Es un requisito legal',
      'Para pagar menos impuestos automáticamente',
    ],
    respuestaCorrecta: 1,
  },
  {
    id: 'g12',
    categoria: 'general',
    pregunta: '¿Qué es "capitalizar" un ahorro?',
    opciones: [
      'Gastarlo por completo',
      'Dejarlo generar intereses/rendimientos con el tiempo',
      'Transferirlo a otra persona',
      'Convertirlo en deuda',
    ],
    respuestaCorrecta: 1,
  },
  {
    id: 'g13',
    categoria: 'general',
    pregunta: 'Una meta financiera con fecha objetivo te ayuda a...',
    opciones: [
      'Calcular cuánto necesitas reservar por mes para cumplirla',
      'Evitar tener que ahorrar',
      'Aumentar tu deuda',
      'No tiene ninguna utilidad',
    ],
    respuestaCorrecta: 0,
  },
];

export function preguntaTopCategoria(porCategoria: Record<string, number>): TriviaQuestion | null {
  const entradas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  if (entradas.length < 2) return null;

  const [topCategoria] = entradas[0];
  const opciones = entradas.slice(0, 4).map(([categoria]) => categoria);
  while (opciones.length < 4) opciones.push('Otros');

  const opcionesMezcladas = [...opciones].sort(() => 0.5 - Math.random());

  return {
    id: 'p-top-categoria',
    categoria: 'personalizada',
    pregunta: '¿En qué categoría gastaste más este período?',
    opciones: opcionesMezcladas,
    respuestaCorrecta: opcionesMezcladas.indexOf(topCategoria),
  };
}

export function preguntaPerfilFinanciero(perfilFinanciero: string | null | undefined): TriviaQuestion | null {
  if (!perfilFinanciero) return null;
  const perfiles = ['Saludable', 'En observación', 'En riesgo'];
  if (!perfiles.includes(perfilFinanciero)) return null;

  const opcionesMezcladas = [...perfiles].sort(() => 0.5 - Math.random());

  return {
    id: 'p-perfil',
    categoria: 'personalizada',
    pregunta: '¿Cuál es tu perfil financiero actual, según el análisis de FinSightAI?',
    opciones: opcionesMezcladas,
    respuestaCorrecta: opcionesMezcladas.indexOf(perfilFinanciero),
  };
}
