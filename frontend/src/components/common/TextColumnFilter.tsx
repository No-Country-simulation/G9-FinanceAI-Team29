import { useState } from 'react';
import { Dropdown } from '../ui/dropdown/Dropdown';

interface TextColumnFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function TextColumnFilter({ value, onChange, placeholder = 'Buscar...' }: TextColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = value.trim().length > 0;

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
        aria-label="Buscar en columna"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M7.25 12.5a5.25 5.25 0 1 0 0-10.5 5.25 5.25 0 0 0 0 10.5ZM14 14l-3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {isActive && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
        )}
      </button>

      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="w-56 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Buscar</span>
          {isActive && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs font-medium text-brand-500 hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm font-normal text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:text-gray-300"
        />
      </Dropdown>
    </span>
  );
}
