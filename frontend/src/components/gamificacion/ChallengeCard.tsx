import Badge from '../ui/badge/Badge';
import type { ChallengeTemplate } from '../../data/gamification';

interface ChallengeCardProps {
  template: ChallengeTemplate;
  completado: boolean;
  progreso: number;
  detalle: string;
}

export default function ChallengeCard({ template, completado, progreso, detalle }: ChallengeCardProps) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{template.titulo}</h3>
        <Badge color={completado ? 'success' : 'light'} size="sm">
          {completado ? 'Cumplido' : 'En curso'}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{template.descripcion}</p>
      <div className="mt-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full rounded-full ${completado ? 'bg-success-500' : 'bg-brand-500'}`}
            style={{ width: `${Math.min(progreso, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{detalle}</p>
      </div>
    </article>
  );
}
