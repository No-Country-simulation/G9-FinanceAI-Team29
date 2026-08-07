import Badge from '../ui/badge/Badge';
import StreakIcon from './StreakIcon';

interface StreakSummaryProps {
  dailyStreak: number;
  bestDailyStreak: number;
  streak: number;
  bestStreak: number;
}

export default function StreakSummary({ dailyStreak, bestDailyStreak, streak, bestStreak }: StreakSummaryProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2">
        <StreakIcon streak={dailyStreak} className="h-9 w-9 shrink-0" />
        <div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{dailyStreak}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">días seguidos</p>
        </div>
        <Badge color="warning" size="sm">
          Mejor racha: {bestDailyStreak}
        </Badge>
      </div>

      <div className="flex items-center gap-2 border-l border-gray-200 pl-4 dark:border-gray-800">
        <StreakIcon streak={streak} fireAt={4} purpleAt={12} className="h-7 w-7 shrink-0" />
        <div className="text-right">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{streak}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">semanas de retos seguidas</p>
        </div>
        <Badge color="light" size="sm">
          Mejor: {bestStreak}
        </Badge>
      </div>
    </div>
  );
}
