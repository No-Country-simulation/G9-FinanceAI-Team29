const COLORES_CATEGORIA: Record<string, string> = {
  'Alimentación': 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400',
  'Compras': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  'Deudas': 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400',
  'Educación': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  'Entretenimiento': 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  'Impuestos': 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  'Otros': 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
  'Otros ingresos': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  'Reintegro': 'bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-400',
  'Salario': 'bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400',
  'Salud': 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  'Servicios': 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400',
  'Transferencia recibida': 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400',
  'Transporte': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  'Venta': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  'Vivienda': 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400',

  // Alias histórico para no romper transacciones antiguas.
  'Ocio': 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
};


const TEXTO_CATEGORIA: Record<string, string> = {
  'Alimentación': 'text-error-500 dark:text-error-400',
  'Compras': 'text-indigo-500 dark:text-indigo-400',
  'Deudas': 'text-rose-500 dark:text-rose-400',
  'Educación': 'text-purple-500 dark:text-purple-400',
  'Entretenimiento': 'text-orange-500 dark:text-orange-400',
  'Impuestos': 'text-amber-500/80 dark:text-amber-400/80',
  'Otros': 'text-gray-500 dark:text-gray-400',
  'Otros ingresos': 'text-emerald-500 dark:text-emerald-400',
  'Reintegro': 'text-lime-600 dark:text-lime-400',
  'Salario': 'text-success-600 dark:text-success-400',
  'Salud': 'text-pink-500 dark:text-pink-400',
  'Servicios': 'text-slate-500 dark:text-slate-400',
  'Transferencia recibida': 'text-teal-500 dark:text-teal-400',
  'Transporte': 'text-blue-500 dark:text-blue-400',
  'Venta': 'text-cyan-500 dark:text-cyan-400',
  'Vivienda': 'text-sky-500 dark:text-sky-400',
  'Ocio': 'text-orange-500 dark:text-orange-400',
};

export const CATEGORIAS_FINANCIERAS = [
  'Transferencia recibida',
  'Entretenimiento',
  'Otros ingresos',
  'Alimentación',
  'Transporte',
  'Educación',
  'Impuestos',
  'Reintegro',
  'Servicios',
  'Vivienda',
  'Compras',
  'Deudas',
  'Salario',
  'Salud',
  'Venta',
  'Otros',
] as const;

export function getCategoriaColor(categoria: string): string {
  return COLORES_CATEGORIA[categoria] || COLORES_CATEGORIA['Otros'];
}


export function getCategoriaTextColor(categoria: string): string {
  return TEXTO_CATEGORIA[categoria] || TEXTO_CATEGORIA['Otros'];
}
