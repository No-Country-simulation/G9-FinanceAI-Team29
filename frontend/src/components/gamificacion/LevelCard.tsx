import Badge from '../ui/badge/Badge';
import type { HealthScoreResult } from '../../utils/gamification';

interface LevelCardProps {
  health: HealthScoreResult;
  puntos: number;
  rangoPuntos: string;
}

export default function LevelCard({ health, puntos, rangoPuntos }: LevelCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-brand-500">Nivel {health.level} / 10</span>
          <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{health.titulo}</h3>
        </div>
        <Badge color="primary" size="sm">Score {health.score}/100</Badge>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(health.score, 100)}%` }} />
      </div>

      <div className="mt-5 space-y-3">
        {health.factores.map((factor) => (
          <div key={factor.nombre}>
            <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{factor.nombre}</span>
              <span>{factor.valor}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: `${Math.min(factor.valor, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        Este puntaje es ilustrativo y busca motivarte a mejorar hábitos financieros: no es un puntaje crediticio real.
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Puntos de actividad</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{rangoPuntos}</p>
        </div>
        <Badge color="warning" size="sm">⭐ {puntos} pts</Badge>
      </div>
    </article>
  );
}
