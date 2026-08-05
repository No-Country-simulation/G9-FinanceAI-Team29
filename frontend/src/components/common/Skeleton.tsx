export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}
