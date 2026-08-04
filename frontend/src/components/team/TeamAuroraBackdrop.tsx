export default function TeamAuroraBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-99998 hidden overflow-hidden sm:block"
    >
      <div className="animate-aurora-drift-1 absolute -left-24 -top-24 h-[30rem] w-[30rem] rounded-full bg-brand-500/70 blur-2xl dark:bg-brand-400/50" />
      <div className="animate-aurora-drift-2 absolute -right-32 top-1/3 h-[34rem] w-[34rem] rounded-full bg-blue-light-500/70 blur-2xl dark:bg-blue-light-400/45" />
      <div className="animate-aurora-drift-3 absolute -bottom-32 left-1/3 h-[30rem] w-[30rem] rounded-full bg-success-500/60 blur-2xl dark:bg-success-500/40" />
    </div>
  );
}
