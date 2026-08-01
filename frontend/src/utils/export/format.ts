import type { CellValue, ColumnType } from './types';

const LOCALE = 'es-AR';

export const isNumericType = (type?: ColumnType) =>
  type === 'currency' || type === 'percent' || type === 'number';

export function formatMoney(value: number): string {
  return `$${Number(value || 0).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number): string {
  return `${Number(value || 0).toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

/** Texto para mostrar en PDF y para medir anchos de columna. */
export function formatCell(value: CellValue, type?: ColumnType): string {
  if (value === null || value === undefined) return '';
  if (!isNumericType(type)) return String(value);

  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  if (type === 'currency') return formatMoney(num);
  if (type === 'percent') return formatPercent(num);
  return num.toLocaleString(LOCALE, { maximumFractionDigits: 2 });
}

/**
 * Valor crudo para CSV estándar (RFC 4180): punto decimal, sin separador de
 * miles y sin símbolo de moneda, para que lo lea cualquier script o sistema.
 */
export function csvValue(value: CellValue, type?: ColumnType): string {
  if (value === null || value === undefined) return '';
  if (!isNumericType(type)) return String(value);

  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  const decimals = type === 'currency' ? 2 : type === 'percent' ? 1 : 2;
  return num.toFixed(decimals);
}

/** Formato numérico nativo de Excel por tipo de columna. */
export function excelNumFmt(type?: ColumnType): string | undefined {
  if (type === 'currency') return '"$"#,##0.00';
  if (type === 'percent') return '0.0"%"';
  if (type === 'number') return '#,##0.##';
  return undefined;
}

export function fechaGeneracion(): string {
  return new Date().toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
