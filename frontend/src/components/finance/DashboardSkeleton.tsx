import { SkeletonBlock } from "../common/Skeleton";

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 ${className}`}
    >
      <div className="animate-pulse space-y-4">
        <SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    </div>
  );
}

// Reproduce la grilla del dashboard real (Home.tsx) para que la transición
// al volver desde otro módulo no "salte" de forma como pasaba con el spinner
// centrado genérico.
export default function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 flex items-center justify-between">
        <SkeletonBlock className="h-8 w-40 animate-pulse" />
        <SkeletonBlock className="h-9 w-28 animate-pulse" />
      </div>

      <SkeletonCard className="col-span-12 xl:col-span-3" />
      <SkeletonCard className="col-span-12 xl:col-span-9" />
      <SkeletonCard className="col-span-12 xl:col-span-9" />
      <SkeletonCard className="col-span-12 xl:col-span-3" />
      <SkeletonCard className="col-span-12 md:col-span-6 xl:col-span-4" />
      <SkeletonCard className="col-span-12 md:col-span-6 xl:col-span-4" />
      <SkeletonCard className="col-span-12 md:col-span-6 xl:col-span-4" />
    </div>
  );
}
