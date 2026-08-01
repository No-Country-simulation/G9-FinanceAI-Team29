import type { KpiColor } from './theme';

/** Tipo de dato de una columna: define formato, alineación y cómo se serializa. */
export type ColumnType = 'text' | 'currency' | 'percent' | 'number' | 'date';

export interface ExportColumn {
  header: string;
  /** Por defecto 'text'. Las columnas numéricas se alinean a la derecha. */
  type?: ColumnType;
}

export interface ExportKpi {
  label: string;
  /** Valor ya formateado para mostrar (ej. "$1.234,56" o "15,4%"). */
  value: string;
  color: KpiColor;
}

export type RowColorFn = (rowIndex: number) => 'success' | 'error' | undefined;

export type CellValue = string | number;

export interface ExportPayload {
  filename: string;
  title: string;
  /** Subtítulo opcional: filtros aplicados, período, etc. */
  subtitle?: string;
  kpis: ExportKpi[];
  columns: ExportColumn[];
  /** Valores crudos: números reales en columnas numéricas, no strings formateados. */
  rows: CellValue[][];
  /**
   * Agrega una fila TOTAL sumando las columnas numéricas. Solo tiene sentido
   * cuando todas las filas son homogéneas (ej. gastos por categoría); en un
   * listado que mezcla ingresos y gastos la suma no significa nada.
   */
  showTotals?: boolean;
  rowColorFn?: RowColorFn;
  logoBase64?: string;
  chartImageBase64?: string;
}
