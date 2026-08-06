import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { usePerfilData } from './PerfilDataContext';
import { obtenerMetas } from '../services/api';
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

const LOGRO_DE_HITO: Partial<Record<EventoGamificacion, AchievementId>> = {
  meta_creada: 'primera_meta',
  csv_importado: 'primer_csv',
};

interface StoredChallenge {
  id: ChallengeKind;
  baseline: ChallengeBaseline;
}

interface Celebracion {
  id: string;
  tipo: 'logro' | 'nivel';
  emoji: string;
  titulo: string;
  detalle: string;
}

interface GamificationState {
  weekKey: string;
  challenges: StoredChallenge[];
  streak: number;
  bestStreak: number;
  bestLevelSeen: number;
  ultimaSubidaNivel: string | null;
  puntos: number;
  logrosDesbloqueados: AchievementId[];
  trivia: {
    lastPlayedDate: string | null;
    bestScore: number;
    correctStreak: number;
  };
}

const VENTANA_NOTIFICACION_NIVEL_MS = 24 * 60 * 60 * 1000;

function defaultState(weekKey: string): GamificationState {
  return {
    weekKey,
    challenges: [],
    streak: 0,
    bestStreak: 0,
    bestLevelSeen: 0,
    ultimaSubidaNivel: null,
    puntos: 0,
    logrosDesbloqueados: [],
    trivia: { lastPlayedDate: null, bestScore: 0, correctStreak: 0 },
  };
}

const storageKey = (usuarioId: string) => `finsight:gamification:${usuarioId}`;

function readState(usuarioId: string): GamificationState | null {
  try {
    const raw = localStorage.getItem(storageKey(usuarioId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GamificationState>;
    return { ...defaultState(parsed.weekKey ?? getIsoWeekKey(new Date())), ...parsed };
  } catch {
    return null;
  }
}

function writeState(usuarioId: string, state: GamificationState) {
  localStorage.setItem(storageKey(usuarioId), JSON.stringify(state));
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

interface GamificationContextValue {
  loading: boolean;
  challenges: ReturnType<typeof buildChallengeEvals>;
  streak: number;
  bestStreak: number;
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
    registrarResultado: (aciertos: number, total: number) => void;
  };
}

function buildChallengeEvals(
  state: GamificationState | null,
  transacciones: Parameters<typeof evaluateChallenge>[2],
  goals: Goal[],
  perfil: Parameters<typeof evaluateChallenge>[4],
) {
  if (!state) return [];
  return state.challenges
    .map((c) => {
      const template = CHALLENGE_CATALOG.find((t) => t.id === c.id);
      if (!template) return null;
      const resultado = evaluateChallenge(template, state.weekKey, transacciones, goals, perfil, c.baseline);
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

  const desbloquearLogro = useCallback((id: AchievementId) => {
    if (!usuarioId) return;
    setState((actual) => {
      if (!actual || actual.logrosDesbloqueados.includes(id)) return actual;
      const def = buscarLogro(id);
      const actualizado: GamificationState = {
        ...actual,
        logrosDesbloqueados: [...actual.logrosDesbloqueados, id],
        puntos: actual.puntos + PUNTOS_POR_LOGRO,
      };
      writeState(usuarioId, actualizado);
      if (def) {
        encolarCelebracion({ id: `logro-${id}-${Date.now()}`, tipo: 'logro', emoji: def.emoji, titulo: def.titulo, detalle: def.descripcion });
      }
      return actualizado;
    });
  }, [usuarioId, encolarCelebracion]);

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

  // Carga el estado persistido y rota los retos si cambió la semana ISO.
  useEffect(() => {
    if (!usuarioId || goalsLoading) return;

    const weekKey = getIsoWeekKey(new Date());
    const stored = readState(usuarioId) ?? defaultState(weekKey);

    if (stored.weekKey === weekKey && stored.challenges.length > 0) {
      setState(stored);
      return;
    }

    const cerrandoSemanaAnterior = stored.weekKey !== weekKey && stored.challenges.length > 0;
    let streak = stored.streak;
    let bestStreak = stored.bestStreak;

    if (cerrandoSemanaAnterior) {
      const completados = stored.challenges.filter((c) => {
        const template = CHALLENGE_CATALOG.find((t) => t.id === c.id);
        if (!template) return false;
        return evaluateChallenge(template, stored.weekKey, transacciones, goals, perfil, c.baseline).completado;
      }).length;

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
      ...stored,
      weekKey,
      challenges: nuevosRetos.map((t) => ({ id: t.id, baseline })),
      streak,
      bestStreak,
    };

    setState(nuevoEstado);
    writeState(usuarioId, nuevoEstado);

    if (streak >= 2 && streak !== stored.streak) {
      desbloquearLogro('racha_dos_semanas');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, goalsLoading]);

  const challenges = useMemo(
    () => buildChallengeEvals(state, transacciones, goals, perfil),
    [state, transacciones, goals, perfil],
  );

  const health = useMemo(() => computeHealthScore(perfil, goals), [perfil, goals]);

  const registrarEvento = useCallback((tipo: EventoGamificacion) => {
    if (!usuarioId) return;
    setState((actual) => {
      if (!actual) return actual;
      const actualizado: GamificationState = {
        ...actual,
        puntos: actual.puntos + PUNTOS_POR_EVENTO[tipo],
      };
      writeState(usuarioId, actualizado);
      return actualizado;
    });

    const logroDeHito = LOGRO_DE_HITO[tipo];
    if (logroDeHito) desbloquearLogro(logroDeHito);
  }, [usuarioId, desbloquearLogro]);

  useEffect(() => {
    if (!usuarioId || !state) return;
    if (health.level > state.bestLevelSeen) {
      const actualizado = { ...state, bestLevelSeen: health.level, ultimaSubidaNivel: new Date().toISOString() };
      setState(actualizado);
      writeState(usuarioId, actualizado);
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

  const registrarResultadoTrivia = useCallback((aciertos: number, total: number) => {
    if (!usuarioId || !state) return;
    const huboRachaCompleta = aciertos === total;
    const actualizado: GamificationState = {
      ...state,
      trivia: {
        lastPlayedDate: todayKey(),
        bestScore: Math.max(state.trivia.bestScore, aciertos),
        correctStreak: huboRachaCompleta ? state.trivia.correctStreak + 1 : 0,
      },
    };
    setState(actualizado);
    writeState(usuarioId, actualizado);
  }, [usuarioId, state]);

  const subioNivelRecientemente = useMemo(() => {
    if (!state?.ultimaSubidaNivel) return false;
    return Date.now() - new Date(state.ultimaSubidaNivel).getTime() < VENTANA_NOTIFICACION_NIVEL_MS;
  }, [state?.ultimaSubidaNivel]);

  const value = useMemo<GamificationContextValue>(() => ({
    loading: perfilLoading || goalsLoading || !state,
    challenges,
    streak: state?.streak ?? 0,
    bestStreak: state?.bestStreak ?? 0,
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
