const COLORES_CATEGORIA: Record<string, string> = {
  'Alimentación': 'bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400',
  'Transporte': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  'Salud': 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  'Vivienda': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  'Educación': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  'Ocio': 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  'Servicios': 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
  'Compras': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  'Otros': 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400',
};

export function getCategoriaColor(categoria: string): string {
  return COLORES_CATEGORIA[categoria] || COLORES_CATEGORIA['Otros'];
}
