import { useState } from 'react';
import { useLocation } from 'react-router';
import PageMeta from '../../components/common/PageMeta';
import ChallengeCard from '../../components/gamificacion/ChallengeCard';
import StreakSummary from '../../components/gamificacion/StreakSummary';
import TriviaQuiz from '../../components/gamificacion/TriviaQuiz';
import AchievementsList from '../../components/gamificacion/AchievementsList';
import Badge from '../../components/ui/badge/Badge';
import { TrophyIcon, FlameIcon } from '../../components/gamificacion/StatIcons';
import { CalenderIcon } from '../../icons';
import { useGamification } from '../../context/GamificationContext';

type Tab = 'retos' | 'trivia';

const TABS: { id: Tab; label: string }[] = [
  { id: 'trivia', label: 'Trivia' },
  { id: 'retos', label: 'Retos' },
];

const TEMAS_TRIVIA = [
  'Fondo de emergencia',
  'Interés compuesto',
  'Regla 50/30/20',
  'Diversificación',
  'Deuda buena vs. mala',
  'Tu categoría de mayor gasto',
  'Tu perfil financiero',
];

// El buscador de la app puede enlazar directo a la pestaña de Retos
// (ej. "/juegos#retos-semanales"), así que la pestaña inicial depende del hash.
const TABS_POR_HASH: Record<string, Tab> = {
  '#retos-semanales': 'retos',
  '#logros': 'retos',
};

export default function Juegos() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => TABS_POR_HASH[location.hash] ?? 'trivia');
  const { loading, challenges, streak, bestStreak, dailyStreak, bestDailyStreak, trivia, logros, desbloquearLogro } = useGamification();

  return (
    <>
      <PageMeta title="Juegos | FinSightAI" description="Retos semanales, trivia financiera y logros" />
      <div className="space-y-6" data-tour="page-games">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Juegos</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Convierte tus hábitos financieros en retos, aprende jugando y desbloquea logros.
          </p>
        </div>

        <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 sm:w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-medium rounded-md text-theme-sm hover:text-gray-900 dark:hover:text-white ${
                tab === t.id
                  ? 'shadow-theme-xs bg-white text-gray-900 dark:bg-gray-800 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Cargando tu progreso…</div>
        ) : (
          <>
            {tab === 'retos' && (
              <div id="retos-semanales" className="scroll-mt-24 space-y-5">
                <StreakSummary
                  dailyStreak={dailyStreak}
                  bestDailyStreak={bestDailyStreak}
                  streak={streak}
                  bestStreak={bestStreak}
                />
                {challenges.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                    Todavía no hay suficientes datos para generar retos esta semana.
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {challenges.map(({ template, completado, progreso, detalle }) => (
                      <ChallengeCard
                        key={template.id}
                        template={template}
                        completado={completado}
                        progreso={progreso}
                        detalle={detalle}
                      />
                    ))}
                  </div>
                )}
                <div id="logros" className="scroll-mt-24">
                  <AchievementsList
                    catalogo={logros.catalogo}
                    desbloqueados={logros.desbloqueados}
                    onPistaCompleta={() => desbloquearLogro('logro_persistente')}
                  />
                </div>
              </div>
            )}

            {tab === 'trivia' && (
              <div id="trivia-financiera" className="scroll-mt-24 grid gap-5 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <TriviaQuiz
                    canPlayToday={trivia.canPlayToday}
                    bestScore={trivia.bestScore}
                    correctStreak={trivia.correctStreak}
                    buildRound={trivia.buildRound}
                    onFinish={trivia.registrarResultado}
                  />
                </div>

                <div className="flex h-full flex-col gap-5 lg:col-span-2">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Tu progreso en trivia</h3>
                    <div className="mt-5 space-y-5 text-sm">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning-50 text-warning-500 dark:bg-warning-500/15 dark:text-warning-400">
                              <TrophyIcon className="h-4 w-4" />
                            </span>
                            Mejor puntaje
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">{trivia.bestScore}/5</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              trivia.bestScore >= 5
                                ? 'bg-purple-500'
                                : trivia.bestScore >= 3
                                  ? 'bg-success-500'
                                  : 'bg-warning-500'
                            }`}
                            style={{ width: `${Math.min((trivia.bestScore / 5) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/15 dark:text-error-400">
                              <FlameIcon className="h-4 w-4" />
                            </span>
                            Racha perfecta
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">{trivia.correctStreak}</span>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-error-500 transition-all duration-500"
                            style={{ width: `${Math.min((trivia.correctStreak / 10) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                            <CalenderIcon className="h-4 w-4" />
                          </span>
                          Intento de hoy
                        </span>
                        <Badge color={trivia.canPlayToday ? 'success' : 'light'} size="sm">
                          {trivia.canPlayToday ? 'Disponible' : 'Ya jugado'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Temas que puedes encontrar</h3>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                      {TEMAS_TRIVIA.map((tema) => (
                        <span
                          key={tema}
                          className="text-sm font-medium text-gray-500 dark:text-gray-400"
                        >
                          #{tema.replace(/\s+/g, '')}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                      Algunas preguntas se generan con tus propios datos financieros.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
