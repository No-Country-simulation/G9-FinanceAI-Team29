import type { AchievementDef, AchievementId } from '../../data/achievements';

interface AchievementsListProps {
  catalogo: AchievementDef[];
  desbloqueados: AchievementId[];
}

export default function AchievementsList({ catalogo, desbloqueados }: AchievementsListProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Logros</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {desbloqueados.length} / {catalogo.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {catalogo.map((logro) => {
          const desbloqueado = desbloqueados.includes(logro.id);
          return (
            <div
              key={logro.id}
              title={desbloqueado ? logro.descripcion : 'Todavía no desbloqueado'}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center ${
                desbloqueado
                  ? 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10'
                  : 'border-gray-200 bg-gray-50 opacity-50 dark:border-gray-800 dark:bg-white/[0.02]'
              }`}
            >
              <span className="text-2xl">{desbloqueado ? logro.emoji : '🔒'}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{logro.titulo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
