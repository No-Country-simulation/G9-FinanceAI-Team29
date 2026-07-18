import { Search } from "lucide-react"

import Input from "../ui/input"

interface TransactionFiltersProps {
  searchTerm: string
  selectedType: string
  selectedCategory: string
  categories: string[]
  onSearchChange: (value: string) => void
  onTypeChange: (value: string) => void
  onCategoryChange: (value: string) => void
}

export default function TransactionFilters({
  searchTerm,
  selectedType,
  selectedCategory,
  categories,
  onSearchChange,
  onTypeChange,
  onCategoryChange,
}: TransactionFiltersProps) {
  return (
    <section className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:grid-cols-[1fr_220px_220px]">
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />

        <Input
          type="text"
          placeholder="Buscar por descripción o categoría..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10"
        />
      </div>

      <select
        value={selectedType}
        onChange={(event) => onTypeChange(event.target.value)}
        className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition-colors focus:border-blue-500"
      >
        <option value="all">Todos los tipos</option>
        <option value="income">Ingresos</option>
        <option value="expense">Gastos</option>
      </select>

      <select
        value={selectedCategory}
        onChange={(event) => onCategoryChange(event.target.value)}
        className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition-colors focus:border-blue-500"
      >
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </section>
  )
}