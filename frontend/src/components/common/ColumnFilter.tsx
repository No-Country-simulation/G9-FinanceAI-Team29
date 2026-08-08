import { useState } from 'react';
import { Dropdown } from '../ui/dropdown/Dropdown';

interface ColumnFilterProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabledOptions?: string[];
}

export default function ColumnFilter({ options, selected, onChange, disabledOptions = [] }: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = selected.length > 0;

  const toggleValue = (value: string) => {
    if (disabledOptions.includes(value)) return;
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`dropdown-toggle relative inline-flex h-6 w-6 items-center justify-center rounded transition-colors ${
          isActive
            ? 'text-brand-500'
            : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
        }`}
        aria-label="Filtrar columna"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.5 2.5h13l-5 6v4.5l-3 1.5V8.5l-5-6z" fill="currentColor" />
        </svg>
        {isActive && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
        )}
      </button>

      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="w-56 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Filtrar</span>
          {isActive && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-brand-500 hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto">
          {options.map((option) => {
            const isDisabled = disabledOptions.includes(option);
            return (
              <label
                key={option}
                title={isDisabled ? 'No combina con los otros filtros activos' : undefined}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-normal ${
                  isDisabled
                    ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                    : 'cursor-pointer text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  disabled={isDisabled}
                  onChange={() => toggleValue(option)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"
                />
                <span className="truncate">{option}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-gray-400">Sin opciones</p>
          )}
        </div>
      </Dropdown>
    </span>
  );
}
