import type { PerfilCompleto } from '../services/api';
import type { Goal, Transaccion } from '../types/finance';
import type { ChallengeTemplate } from '../data/gamification';

/** Identifica la semana ISO activa (lunes a domingo), para rotar retos. */
export function getIsoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Selección determinística de N retos de la semana (mismo usuario + semana => mismos retos). */
export function pickWeeklyChallenges(
  usuarioId: string,
  weekKey: string,
  catalog: ChallengeTemplate[],
  count: number,
): ChallengeTemplate[] {
  const seed = hashString(`${usuarioId}:${weekKey}`);
  const pool = [...catalog];
  const picked: ChallengeTemplate[] = [];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = (seed + i * 7) % pool.length;
    picked.push(pool[index]);
    pool.splice(index, 1);
  }

  return picked;
}

function transaccionesDeLaSemana(transacciones: Transaccion[], weekKey: string): Transaccion[] {
  return transacciones.filter((t) => getIsoWeekKey(new Date(t.fecha)) === weekKey);
}

export interface ChallengeBaseline {
  /** progreso (%) de la meta activa con mejor progreso al momento de asignar el reto, si aplica */
  metaProgresoInicial?: number;
  metaId?: string;
}

export interface ChallengeEvalResult {
  completado: boolean;
  progreso: number; // 0-100, para la barra de la tarjeta
  detalle: string;
}

/** Evalúa una plantilla de reto contra los datos ya cargados del usuario (sin llamadas nuevas). */
export function evaluateChallenge(
  template: ChallengeTemplate,
  weekKey: string,
  transacciones: Transaccion[],
  goals: Goal[],
  perfil: PerfilCompleto | null,
  baseline: ChallengeBaseline,
): ChallengeEvalResult {
  const semana = transaccionesDeLaSemana(transacciones, weekKey);

  switch (template.kind) {
    case 'gasto_bajo_promedio': {
      const gastoSemana = semana
        .filter((t) => t.tipo === 'Gasto')
        .reduce((acc, t) => acc + Number(t.monto), 0);
      const promedioSemanal = (perfil?.gastoMensualPromedio ?? 0) / 4;
      if (promedioSemanal <= 0) return { completado: false, progreso: 0, detalle: 'Sin datos suficientes todavía.' };
      const progreso = Math.max(0, Math.min(100, 100 - (gastoSemana / promedioSemanal) * 100));
      return {
        completado: gastoSemana <= promedioSemanal,
        progreso,
        detalle: `Gastaste ${gastoSemana.toFixed(0)} de un tope de ${promedioSemanal.toFixed(0)} esta semana.`,
      };
    }
    case 'evitar_categoria_top': {
      const porCategoria: Record<string, number> = {};
      for (const t of transacciones) {
        if (t.tipo === 'Gasto') porCategoria[t.categoria] = (porCategoria[t.categoria] ?? 0) + Number(t.monto);
      }
      const topCategoria = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!topCategoria) return { completado: false, progreso: 0, detalle: 'Sin datos suficientes todavía.' };
      const gastoEnTop = semana.filter((t) => t.tipo === 'Gasto' && t.categoria === topCategoria).length;
      return {
        completado: gastoEnTop === 0,
        progreso: gastoEnTop === 0 ? 100 : 0,
        detalle: `Categoría a evitar esta semana: ${topCategoria}.`,
      };
    }
    case 'registrar_ingreso_o_ahorro': {
      const huboIngreso = semana.some((t) => t.tipo === 'Ingreso');
      return {
        completado: huboIngreso,
        progreso: huboIngreso ? 100 : 0,
        detalle: huboIngreso ? 'Ya registraste un ingreso esta semana.' : 'Todavía no registras ingresos esta semana.',
      };
    }
    case 'avanzar_meta': {
      const activa = goals.find((g) => g.id === baseline.metaId) ?? goals.find((g) => g.estado === 'ACTIVA');
      if (!activa) return { completado: false, progreso: 0, detalle: 'Crea una meta activa para poder cumplir este reto.' };
      const inicial = baseline.metaProgresoInicial ?? activa.progreso;
      const delta = Math.max(0, activa.progreso - inicial);
      return {
        completado: delta >= 5,
        progreso: Math.max(0, Math.min(100, (delta / 5) * 100)),
        detalle: `Avanzaste ${delta.toFixed(1)} puntos de progreso en “${activa.nombre}”.`,
      };
    }
    default:
      return { completado: false, progreso: 0, detalle: '' };
  }
}

export interface HealthScoreResult {
  score: number; // 0-100
  level: number; // 1-10
  titulo: string;
  factores: { nombre: string; valor: number }[];
}

const RANGO_PUNTOS: { min: number; titulo: string }[] = [
  { min: 0, titulo: 'Recluta financiero' },
  { min: 50, titulo: 'Contribuyente activo' },
  { min: 150, titulo: 'Usuario habitual' },
  { min: 300, titulo: 'Veterano de FinSight' },
  { min: 500, titulo: 'Leyenda de FinSight' },
];

export function computePointsRango(puntos: number): string {
  return [...RANGO_PUNTOS].reverse().find((r) => puntos >= r.min)?.titulo ?? RANGO_PUNTOS[0].titulo;
}

const NIVEL_TITULOS = [
  'Novato financiero',
  'Aprendiz de ahorro',
  'Organizador en marcha',
  'Planificador constante',
  'Estratega financiero',
  'Guardián del presupuesto',
  'Inversor en formación',
  'Maestro del ahorro',
  'Referente financiero',
  'Maestro Financiero',
];

/**
 * Score ilustrativo (no es un puntaje crediticio real), pensado para motivar:
 * 40% perfil de riesgo del modelo, 30% ratio ahorro/ingreso, 30% progreso de metas activas.
 */
export function computeHealthScore(perfil: PerfilCompleto | null, goals: Goal[]): HealthScoreResult {
  const perfilFinancieroScore = (() => {
    switch (perfil?.perfilFinanciero) {
      case 'Saludable': return 100;
      case 'En observación': return 60;
      case 'En riesgo': return 20;
      default: return 50;
    }
  })();

  const ahorroRatio = perfil?.ingresoMensual && perfil.ingresoMensual > 0
    ? ((perfil.ahorroMensualEstimado ?? 0) / perfil.ingresoMensual) * 100
    : 0;
  const ahorroScore = Math.max(0, Math.min(100, ahorroRatio));

  const activas = goals.filter((g) => g.estado === 'ACTIVA');
  const metasScore = activas.length === 0
    ? 30
    : Math.max(0, Math.min(100, activas.reduce((acc, g) => acc + g.progreso, 0) / activas.length));

  const score = Math.round(perfilFinancieroScore * 0.4 + ahorroScore * 0.3 + metasScore * 0.3);
  const level = Math.min(10, Math.max(1, 1 + Math.floor(score / 10)));

  return {
    score,
    level,
    titulo: NIVEL_TITULOS[level - 1],
    factores: [
      { nombre: 'Perfil de riesgo', valor: perfilFinancieroScore },
      { nombre: 'Ahorro / ingreso', valor: Math.round(ahorroScore) },
      { nombre: 'Progreso de metas', valor: Math.round(metasScore) },
    ],
  };
}
