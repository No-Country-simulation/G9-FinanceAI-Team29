import { useState } from 'react';
import PageMeta from '../../components/common/PageMeta';
import ChallengeCard from '../../components/gamificacion/ChallengeCard';
import StreakSummary from '../../components/gamificacion/StreakSummary';
import TriviaQuiz from '../../components/gamificacion/TriviaQuiz';
import AchievementsList from '../../components/gamificacion/AchievementsList';
import { useGamification } from '../../context/GamificationContext';

type Tab = 'retos' | 'trivia';

const TABS: { id: Tab; label: string }[] = [
  { id: 'trivia', label: 'Trivia' },
  { id: 'retos', label: 'Retos' },
];

export default function Juegos() {
  const [tab, setTab] = useState<Tab>('trivia');
  const { loading, challenges, streak, bestStreak, trivia, logros } = useGamification();

  return (
    <>
      <PageMeta title="Juegos | FinSightAI" description="Retos semanales, trivia financiera y logros" />
      <div className="space-y-6">
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
              <div className="space-y-5">
                <StreakSummary streak={streak} bestStreak={bestStreak} />
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
                <AchievementsList catalogo={logros.catalogo} desbloqueados={logros.desbloqueados} />
              </div>
            )}

            {tab === 'trivia' && (
              <TriviaQuiz
                canPlayToday={trivia.canPlayToday}
                bestScore={trivia.bestScore}
                correctStreak={trivia.correctStreak}
                buildRound={trivia.buildRound}
                onFinish={trivia.registrarResultado}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
