import { saveBlob } from './downloadBlob';
import { csvValue } from './format';
import type { ExportPayload } from './types';

const DELIMITER = ',';

function escapeCsvCell(value: string): string {
  if (/["\n\r,]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSV estándar (RFC 4180): coma como separador, punto decimal, UTF-8 sin BOM
 * y saltos CRLF. Datos crudos, sin formato ni decoración — pensado para que
 * lo consuma otro sistema, no para abrirlo en Excel.
 */
export function exportToCsv({ filename, columns, rows }: ExportPayload) {
  const lines: string[] = [];

  lines.push(columns.map((col) => escapeCsvCell(col.header)).join(DELIMITER));

  rows.forEach((row) => {
    lines.push(
      row
        .map((value, idx) => escapeCsvCell(csvValue(value, columns[idx]?.type)))
        .join(DELIMITER)
    );
  });

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  saveBlob(blob, `${filename}.csv`);
}
