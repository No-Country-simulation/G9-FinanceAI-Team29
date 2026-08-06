import Badge from '../ui/badge/Badge';

interface StreakSummaryProps {
  streak: number;
  bestStreak: number;
}

export default function StreakSummary({ streak, bestStreak }: StreakSummaryProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2">
        <span className="text-3xl leading-none">🔥</span>
        <div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{streak}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">semanas seguidas</p>
        </div>
      </div>
      <Badge color="warning" size="sm">
        Mejor racha: {bestStreak}
      </Badge>
    </div>
  );
}
