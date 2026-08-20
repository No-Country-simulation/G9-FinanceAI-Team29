import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { usePerfilData } from './PerfilDataContext';
import {
  obtenerMetas,
  obtenerLogrosDesbloqueados,
  desbloquearLogroRemoto,
  guardarRetoProgreso,
  registrarResultadosTrivia,
  obtenerEstadoGamificacion,
  guardarEstadoGamificacion,
  obtenerEstadisticasTrivia,
  type EstadoGamificacionDTO,
} from '../services/api';
import type { Goal } from '../types/finance';
import { ACHIEVEMENTS_CATALOG, buscarLogro, type AchievementId } from '../data/achievements';
import {
  CHALLENGE_CATALOG,
  preguntaPerfilFinanciero,
  preguntaTopCategoria,
  TRIVIA_QUESTIONS_GENERAL,
  type ChallengeKind,
  type TriviaQuestion,
} from '../data/gamification';
import {
  computeHealthScore,
  computePointsRango,
  evaluateChallenge,
  getIsoWeekKey,
  pickWeeklyChallenges,
  type ChallengeBaseline,
} from '../utils/gamification';
import type { TriviaRespuesta } from '../components/gamificacion/TriviaQuiz';

const CHALLENGES_PER_WEEK = 3;
const CHALLENGE_COMPLETION_THRESHOLD = 2;
const TRIVIA_QUESTIONS_PER_ROUND = 5;

export type EventoGamificacion =
  | 'meta_creada'
  | 'ahorro_meta'
  | 'csv_importado'
  | 'mensaje_asistente';

const PUNTOS_POR_EVENTO: Record<EventoGamificacion, number> = {
  meta_creada: 15,
  ahorro_meta: 5,
  csv_importado: 20,
  mensaje_asistente: 2,
};

const PUNTOS_POR_LOGRO = 25;

// No incluye 'coleccionista_secretos' (categoría 'hito'): completar los especiales
// es justamente lo que lo desbloquea, así que no puede depender de sí mismo.
const ESPECIALES_IDS: AchievementId[] = ACHIEVEMENTS_CATALOG
  .filter((a) => a.categoria === 'especial')
  .map((a) => a.id);

const LOGRO_DE_HITO: Partial<Record<EventoGamificacion, AchievementId>> = {
  meta_creada: 'primera_meta',
  csv_importado: 'primer_csv',
};

interface Celebracion {
  id: string;
  tipo: 'logro' | 'nivel';
  emoji: string;
  emojiImg?: string;
  titulo: string;
  detalle: string;
}

// Todo el estado de gamificación vive en Supabase (tablas gamificacion_estado,
// retos_progreso, trivia_resultados y logros_desbloqueados). Este objeto es solo
// una copia en memoria para renderizar; no se persiste en localStorage.
interface GamificationState {
  weekKey: string;
  challengeIds: ChallengeKind[];
  challengesBaseline: ChallengeBaseline;
  streak: number;
  bestStreak: number;
  lastActiveDate: string | null;
  dailyStreak: number;
  bestDailyStreak: number;
  bestLevelSeen: number;
  ultimaSubidaNivel: string | null;
  puntos: number;
  mensajesAsistente: number;
  logrosDesbloqueados: AchievementId[];
  trivia: {
    lastPlayedDate: string | null;
    bestScore: number;
    correctStreak: number;
  };
}

const VENTANA_NOTIFICACION_NIVEL_MS = 24 * 60 * 60 * 1000;

function persistEstado(usuarioId: string, state: GamificationState) {
  const dto: EstadoGamificacionDTO = {
    weekKey: state.weekKey,
    challengesBaseline: JSON.stringify(state.challengesBaseline ?? {}),
    streak: state.streak,
    bestStreak: state.bestStreak,
    lastActiveDate: state.lastActiveDate,
    dailyStreak: state.dailyStreak,
    bestDailyStreak: state.bestDailyStreak,
    bestLevelSeen: state.bestLevelSeen,
    ultimaSubidaNivel: state.ultimaSubidaNivel,
    puntos: state.puntos,
    mensajesAsistente: state.mensajesAsistente,
  };
  guardarEstadoGamificacion(usuarioId, dto).catch((error) =>
    console.error('No se pudo sincronizar el progreso con el servidor:', error),
  );
}

function buildBaseline(goals: Goal[]): ChallengeBaseline {
  const mejor = goals
    .filter((g) => g.estado === 'ACTIVA')
    .sort((a, b) => b.progreso - a.progreso)[0];
  if (!mejor) return {};
  return { metaId: mejor.id, metaProgresoInicial: mejor.progreso };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Convención: las marcas de tiempo que persistimos en Supabase (LocalDateTime, sin
// zona horaria) se generan y leen siempre en UTC "naive", agregando/quitando la 'Z'
// a mano para no romper el parseo de LocalDateTime en el backend.
function nowNaiveIso(): string {
  return new Date().toISOString().replace('Z', '');
}

function parseNaiveIso(value: string): number {
  return new Date(`${value}Z`).getTime();
}

function esDiaConsecutivo(anteriorKey: string, actualKey: string): boolean {
  const anterior = new Date(`${anteriorKey}T00:00:00`).getTime();
  const actual = new Date(`${actualKey}T00:00:00`).getTime();
  return Math.round((actual - anterior) / 86_400_000) === 1;
}

interface GamificationContextValue {
  loading: boolean;
  challenges: ReturnType<typeof buildChallengeEvals>;
  streak: number;
  bestStreak: number;
  dailyStreak: number;
  bestDailyStreak: number;
  health: ReturnType<typeof computeHealthScore>;
  puntos: number;
  rangoPuntos: string;
  logros: { catalogo: typeof ACHIEVEMENTS_CATALOG; desbloqueados: AchievementId[] };
  subioNivelRecientemente: boolean;
  registrarEvento: (tipo: EventoGamificacion) => void;
  desbloquearLogro: (id: AchievementId) => void;
  celebracion: Celebracion | null;
  cerrarCelebracion: () => void;
  trivia: {
    canPlayToday: boolean;
    bestScore: number;
    correctStreak: number;
    buildRound: () => TriviaQuestion[];
    registrarResultado: (aciertos: number, total: number, respuestas: TriviaRespuesta[]) => void;
  };
}

function buildChallengeEvals(
  state: GamificationState | null,
  transacciones: Parameters<typeof evaluateChallenge>[2],
  goals: Goal[],
  perfil: Parameters<typeof evaluateChallenge>[4],
) {
  if (!state) return [];
  return state.challengeIds
    .map((id) => {
      const template = CHALLENGE_CATALOG.find((t) => t.id === id);
      if (!template) return null;
      const resultado = evaluateChallenge(template, state.weekKey, transacciones, goals, perfil, state.challengesBaseline);
      return { template, ...resultado };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

const GamificationContext = createContext<GamificationContextValue | undefined>(undefined);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { usuarioId } = useAuth();
  const { perfil, transacciones, resumen, loading: perfilLoading } = usePerfilData();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [state, setState] = useState<GamificationState | null>(null);
  const [colaCelebraciones, setColaCelebraciones] = useState<Celebracion[]>([]);

  const encolarCelebracion = useCallback((celebracion: Celebracion) => {
    setColaCelebraciones((cola) => [...cola, celebracion]);
  }, []);

  // El updater de setState debe ser puro (React puede invocarlo más de una vez,
  // sobre todo en StrictMode); por eso NO se llama a la API acá adentro — solo se
  // actualiza el estado en memoria. La sincronización con Supabase vive en el
  // efecto de abajo, con un ref que garantiza "una sola vez por logro nuevo".
  const logrosPendientesRef = useRef<Set<AchievementId>>(new Set());

  const desbloquearLogro = useCallback((id: AchievementId) => {
    if (!usuarioId) return;
    setState((actual) => {
      if (!actual) {
        // El progreso todavía no terminó de cargar desde Supabase (p. ej. el
        // usuario navegó rapidísimo a una pantalla con un logro apenas entró
        // a la app): guardamos el id para aplicarlo en cuanto el estado
        // inicial esté listo, en vez de perderlo silenciosamente.
        logrosPendientesRef.current.add(id);
        return actual;
      }
      if (actual.logrosDesbloqueados.includes(id)) return actual;
      const nuevosLogros = [...actual.logrosDesbloqueados, id];
      // "Coleccionista de secretos": se otorga solo, sin depender del componente que
      // llame a desbloquearLogro, en cuanto el nuevo logro completa todos los especiales.
      const faltaColeccionista = !nuevosLogros.includes('coleccionista_secretos');
      const completoTodosLosEspeciales = ESPECIALES_IDS.every((eid) => nuevosLogros.includes(eid));
      if (id !== 'coleccionista_secretos' && faltaColeccionista && completoTodosLosEspeciales) {
        nuevosLogros.push('coleccionista_secretos');
      }
      return {
        ...actual,
        logrosDesbloqueados: nuevosLogros,
        puntos: actual.puntos + PUNTOS_POR_LOGRO * (nuevosLogros.length - actual.logrosDesbloqueados.length),
      };
    });
  }, [usuarioId]);

  // Aplica logros que llegaron mientras `state` todavía era null (ver comentario
  // arriba). Corre en cada cambio de estado, pero es un no-op salvo la primera
  // vez que hay pendientes, justo cuando el estado inicial termina de cargar.
  useEffect(() => {
    if (!state || logrosPendientesRef.current.size === 0) return;
    const pendientes = Array.from(logrosPendientesRef.current);
    logrosPendientesRef.current.clear();
    pendientes.forEach((id) => desbloquearLogro(id));
  }, [state, desbloquearLogro]);

  const logrosSincronizadosRef = useRef<Set<AchievementId>>(new Set());

  useEffect(() => {
    if (!usuarioId || !state) return;
    const nuevos = state.logrosDesbloqueados.filter((id) => !logrosSincronizadosRef.current.has(id));
    if (nuevos.length === 0) return;

    nuevos.forEach((id) => {
      logrosSincronizadosRef.current.add(id);
      desbloquearLogroRemoto(usuarioId, id).catch((error) =>
        console.error('No se pudo sincronizar el logro con el servidor:', error),
      );
      const def = buscarLogro(id);
      if (def) {
        encolarCelebracion({ id: `logro-${id}-${Date.now()}`, tipo: 'logro', emoji: def.emoji, emojiImg: def.imagenUrl, titulo: def.titulo, detalle: def.descripcion });
      }
    });
    persistEstado(usuarioId, state);
  }, [usuarioId, state, encolarCelebracion]);

  useEffect(() => {
    if (!usuarioId) {
      setGoals([]);
      setGoalsLoading(false);
      return;
    }

    let cancelado = false;
    setGoalsLoading(true);
    obtenerMetas(usuarioId)
      .then((data) => { if (!cancelado) setGoals(data); })
      .catch((error) => console.error('No se pudieron cargar las metas para gamificación:', error))
      .finally(() => { if (!cancelado) setGoalsLoading(false); });

    return () => { cancelado = true; };
  }, [usuarioId]);

  // Carga TODO el progreso desde Supabase (estado agregado, logros y estadísticas de
  // trivia) y rota los retos si cambió la semana ISO. No hay lectura ni escritura de
  // localStorage en ningún punto: entrar desde otro dispositivo trae el mismo progreso.
  useEffect(() => {
    if (!usuarioId || goalsLoading) return;
    let cancelado = false;

    (async () => {
      const weekKey = getIsoWeekKey(new Date());
      let estadoRemoto: EstadoGamificacionDTO | null = null;
      let logrosRemotos: AchievementId[] = [];
      let triviaRemota = { lastPlayedDate: null as string | null, bestScore: 0, correctStreak: 0 };

      // Cada llamada se maneja de forma independiente: si una falla (p. ej. el
      // endpoint de estado), las otras dos no deben perderse por un solo catch
      // compartido, o los logros/hitos ya guardados desaparecerían de la UI.
      const [estadoResult, logrosResult, triviaResult] = await Promise.allSettled([
        obtenerEstadoGamificacion(usuarioId),
        obtenerLogrosDesbloqueados(usuarioId),
        obtenerEstadisticasTrivia(usuarioId),
      ]);

      if (estadoResult.status === 'fulfilled') {
        estadoRemoto = estadoResult.value;
      } else {
        console.error('No se pudo cargar el estado de gamificación desde el servidor:', estadoResult.reason);
      }

      if (logrosResult.status === 'fulfilled') {
        logrosRemotos = logrosResult.value.map((l) => l.logroId as AchievementId);
      } else {
        console.error('No se pudieron cargar los logros desbloqueados desde el servidor:', logrosResult.reason);
      }

      if (triviaResult.status === 'fulfilled') {
        const trivia = triviaResult.value;
        triviaRemota = { lastPlayedDate: trivia.lastPlayedDate, bestScore: trivia.bestScore, correctStreak: trivia.correctStreak };
      } else {
        console.error('No se pudieron cargar las estadísticas de trivia desde el servidor:', triviaResult.reason);
      }

      if (cancelado) return;

      // Los logros que ya venían desbloqueados en Supabase no son "nuevos": se marcan
      // como ya sincronizados para que el efecto de sync no los reenvíe ni repita el
      // toast de celebración en cada carga de la página.
      logrosRemotos.forEach((id) => logrosSincronizadosRef.current.add(id));

      const stored = estadoRemoto
        ? {
            weekKey: estadoRemoto.weekKey,
            challengesBaseline: (estadoRemoto.challengesBaseline ? JSON.parse(estadoRemoto.challengesBaseline) : {}) as ChallengeBaseline,
            streak: estadoRemoto.streak,
            bestStreak: estadoRemoto.bestStreak,
            lastActiveDate: estadoRemoto.lastActiveDate,
            dailyStreak: estadoRemoto.dailyStreak,
            bestDailyStreak: estadoRemoto.bestDailyStreak,
            bestLevelSeen: estadoRemoto.bestLevelSeen,
            ultimaSubidaNivel: estadoRemoto.ultimaSubidaNivel,
            puntos: estadoRemoto.puntos,
            mensajesAsistente: estadoRemoto.mensajesAsistente,
          }
        : {
            weekKey,
            challengesBaseline: {} as ChallengeBaseline,
            streak: 0,
            bestStreak: 0,
            lastActiveDate: null as string | null,
            dailyStreak: 0,
            bestDailyStreak: 0,
            bestLevelSeen: 0,
            ultimaSubidaNivel: null as string | null,
            puntos: 0,
            mensajesAsistente: 0,
          };

      if (stored.weekKey === weekKey && estadoRemoto) {
        const challengeIds = pickWeeklyChallenges(usuarioId, weekKey, CHALLENGE_CATALOG, CHALLENGES_PER_WEEK).map((t) => t.id);
        setState({ ...stored, challengeIds, logrosDesbloqueados: logrosRemotos, trivia: triviaRemota });
        return;
      }

      let streak = stored.streak;
      let bestStreak = stored.bestStreak;

      if (estadoRemoto) {
        const templatesSemanaAnterior = pickWeeklyChallenges(usuarioId, stored.weekKey, CHALLENGE_CATALOG, CHALLENGES_PER_WEEK);
        const completados = templatesSemanaAnterior.filter(
          (template) => evaluateChallenge(template, stored.weekKey, transacciones, goals, perfil, stored.challengesBaseline).completado,
        ).length;

        if (completados >= CHALLENGE_COMPLETION_THRESHOLD) {
          streak += 1;
          bestStreak = Math.max(bestStreak, streak);
        } else {
          streak = 0;
        }
      }

      const nuevosRetos = pickWeeklyChallenges(usuarioId, weekKey, CHALLENGE_CATALOG, CHALLENGES_PER_WEEK);
      const baseline = buildBaseline(goals);
      const nuevoEstado: GamificationState = {
        weekKey,
        challengeIds: nuevosRetos.map((t) => t.id),
        challengesBaseline: baseline,
        streak,
        bestStreak,
        lastActiveDate: stored.lastActiveDate,
        dailyStreak: stored.dailyStreak,
        bestDailyStreak: stored.bestDailyStreak,
        bestLevelSeen: stored.bestLevelSeen,
        ultimaSubidaNivel: stored.ultimaSubidaNivel,
        puntos: stored.puntos,
        mensajesAsistente: stored.mensajesAsistente,
        logrosDesbloqueados: logrosRemotos,
        trivia: triviaRemota,
      };

      setState(nuevoEstado);
      persistEstado(usuarioId, nuevoEstado);

      if (streak >= 2 && streak !== stored.streak) {
        desbloquearLogro('racha_dos_semanas');
      }
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, goalsLoading]);

  // Suma la racha diaria (días consecutivos con actividad en la app), independiente de la racha semanal de retos.
  useEffect(() => {
    if (!usuarioId || !state) return;
    const today = todayKey();
    if (state.lastActiveDate === today) return;

    const dailyStreak = state.lastActiveDate && esDiaConsecutivo(state.lastActiveDate, today)
      ? state.dailyStreak + 1
      : 1;
    const bestDailyStreak = Math.max(state.bestDailyStreak, dailyStreak);

    const actualizado: GamificationState = { ...state, lastActiveDate: today, dailyStreak, bestDailyStreak };
    setState(actualizado);
    persistEstado(usuarioId, actualizado);
  }, [usuarioId, state]);

  const challenges = useMemo(
    () => buildChallengeEvals(state, transacciones, goals, perfil),
    [state, transacciones, goals, perfil],
  );

  // Persiste en Supabase el progreso de cada reto de la semana, una sola vez
  // por combinación (semana, reto, estado de completado) para no spamear la API.
  const retosSincronizadosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!usuarioId || !state || challenges.length === 0) return;
    for (const { template, completado, progreso } of challenges) {
      const clave = `${state.weekKey}:${template.id}:${completado}`;
      if (retosSincronizadosRef.current.has(clave)) continue;
      retosSincronizadosRef.current.add(clave);
      guardarRetoProgreso(usuarioId, template.id, state.weekKey, completado, JSON.stringify(progreso ?? {})).catch(
        (error) => console.error('No se pudo sincronizar el reto con el servidor:', error),
      );
    }
  }, [usuarioId, state, challenges]);

  const health = useMemo(() => computeHealthScore(perfil, goals), [perfil, goals]);

  const registrarEvento = useCallback((tipo: EventoGamificacion) => {
    if (!usuarioId) return;
    setState((actual) => {
      if (!actual) return actual;
      const actualizado: GamificationState = {
        ...actual,
        puntos: actual.puntos + PUNTOS_POR_EVENTO[tipo],
        mensajesAsistente: tipo === 'mensaje_asistente'
          ? actual.mensajesAsistente + 1
          : actual.mensajesAsistente,
      };
      persistEstado(usuarioId, actualizado);
      return actualizado;
    });

    const logroDeHito = LOGRO_DE_HITO[tipo];
    if (logroDeHito) desbloquearLogro(logroDeHito);
  }, [usuarioId, desbloquearLogro]);

  useEffect(() => {
    if (!usuarioId || !state) return;

    // Primera inicialización: registramos el nivel de partida sin mostrar una
    // celebración falsa de "subida". A partir de ahí, solo se celebra una mejora real.
    if (state.bestLevelSeen === 0) {
      const inicializado = {
        ...state,
        bestLevelSeen: health.level,
        ultimaSubidaNivel: null,
      };
      setState(inicializado);
      persistEstado(usuarioId, inicializado);
      return;
    }

    if (health.level > state.bestLevelSeen) {
      const actualizado = { ...state, bestLevelSeen: health.level, ultimaSubidaNivel: nowNaiveIso() };
      setState(actualizado);
      persistEstado(usuarioId, actualizado);
      encolarCelebracion({
        id: `nivel-${health.level}-${Date.now()}`,
        tipo: 'nivel',
        emoji: '🏆',
        titulo: `¡Subiste a nivel ${health.level}!`,
        detalle: health.titulo,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health.level, usuarioId]);

  const cerrarCelebracion = useCallback(() => {
    setColaCelebraciones((cola) => cola.slice(1));
  }, []);

  const canPlayTriviaToday = useMemo(() => {
    if (!state) return false;
    return state.trivia.lastPlayedDate !== todayKey();
  }, [state]);

  const buildTriviaRound = useCallback((): TriviaQuestion[] => {
    const personalizadas = [
      preguntaTopCategoria(resumen.porCategoria),
      preguntaPerfilFinanciero(perfil?.perfilFinanciero),
    ].filter((q): q is TriviaQuestion => q !== null);

    const generales = [...TRIVIA_QUESTIONS_GENERAL].sort(() => 0.5 - Math.random());
    const necesarias = TRIVIA_QUESTIONS_PER_ROUND - personalizadas.length;
    return [...personalizadas, ...generales.slice(0, Math.max(0, necesarias))];
  }, [resumen.porCategoria, perfil?.perfilFinanciero]);

  const registrarResultadoTrivia = useCallback((aciertos: number, total: number, respuestas: TriviaRespuesta[]) => {
    if (!usuarioId || !state) return;
    const huboRachaCompleta = aciertos === total;
    setState((actual) => {
      if (!actual) return actual;
      return {
        ...actual,
        trivia: {
          lastPlayedDate: todayKey(),
          bestScore: Math.max(actual.trivia.bestScore, aciertos),
          correctStreak: huboRachaCompleta ? actual.trivia.correctStreak + 1 : 0,
        },
      };
    });
    // Las estadísticas de trivia se derivan siempre de trivia_resultados en Supabase
    // (no forman parte del estado agregado); el update local de arriba es solo optimista.
    if (respuestas.length > 0) {
      registrarResultadosTrivia(usuarioId, respuestas).catch((error) =>
        console.error('No se pudo sincronizar la trivia con el servidor:', error),
      );
    }
    if (huboRachaCompleta && total > 0) {
      desbloquearLogro('trivia_perfecta');
    }
  }, [usuarioId, state, desbloquearLogro]);

  const subioNivelRecientemente = useMemo(() => {
    if (!state?.ultimaSubidaNivel) return false;
    return Date.now() - parseNaiveIso(state.ultimaSubidaNivel) < VENTANA_NOTIFICACION_NIVEL_MS;
  }, [state?.ultimaSubidaNivel]);

  const value = useMemo<GamificationContextValue>(() => ({
    loading: perfilLoading || goalsLoading || !state,
    challenges,
    streak: state?.streak ?? 0,
    bestStreak: state?.bestStreak ?? 0,
    dailyStreak: state?.dailyStreak ?? 0,
    bestDailyStreak: state?.bestDailyStreak ?? 0,
    health,
    puntos: state?.puntos ?? 0,
    rangoPuntos: computePointsRango(state?.puntos ?? 0),
    logros: { catalogo: ACHIEVEMENTS_CATALOG, desbloqueados: state?.logrosDesbloqueados ?? [] },
    subioNivelRecientemente,
    registrarEvento,
    desbloquearLogro,
    celebracion: colaCelebraciones[0] ?? null,
    cerrarCelebracion,
    trivia: {
      canPlayToday: canPlayTriviaToday,
      bestScore: state?.trivia.bestScore ?? 0,
      correctStreak: state?.trivia.correctStreak ?? 0,
      buildRound: buildTriviaRound,
      registrarResultado: registrarResultadoTrivia,
    },
  }), [
    perfilLoading, goalsLoading, state, challenges, health, registrarEvento, desbloquearLogro,
    colaCelebraciones, cerrarCelebracion, canPlayTriviaToday, buildTriviaRound, registrarResultadoTrivia,
    subioNivelRecientemente,
  ]);

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) {
    throw new Error('useGamification debe usarse dentro de <GamificationProvider>');
  }
  return ctx;
}
