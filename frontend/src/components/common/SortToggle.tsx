interface SortToggleProps {
  order: 'asc' | 'desc';
  onToggle: () => void;
}

export default function SortToggle({ order, onToggle }: SortToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={order === 'desc' ? 'Ordenar de más antiguo a más reciente' : 'Ordenar de más reciente a más antiguo'}
      title={order === 'desc' ? 'Más reciente primero' : 'Más antiguo primero'}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-brand-500 transition-colors hover:text-brand-600"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`transition-transform ${order === 'asc' ? 'rotate-180' : ''}`}
      >
        <path
          d="M4 6.5 8 10.5 12 6.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
