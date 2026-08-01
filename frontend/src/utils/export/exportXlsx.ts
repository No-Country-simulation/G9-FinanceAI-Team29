import ExcelJS from 'exceljs';
import { saveBlob } from './downloadBlob';
import { EXPORT_COLORS } from './theme';
import { excelNumFmt, fechaGeneracion, formatCell, isNumericType } from './format';
import type { ExportPayload } from './types';

const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase();

const INK = argb(EXPORT_COLORS.textDark);
const MUTED = argb(EXPORT_COLORS.gray);
const HAIRLINE = 'FFEAECF0';

const ACCENT: Record<string, string> = {
  brand: argb(EXPORT_COLORS.brand),
  success: argb(EXPORT_COLORS.success),
  error: argb(EXPORT_COLORS.error),
};

const FONT = 'Calibri';
const FIRST_COL = 2; // La columna A queda como margen izquierdo.
const GUTTER_WIDTH = 2;
/** Ancho mínimo del informe en caracteres, para que no quede una tira angosta. */
const MIN_REPORT_WIDTH = 94;

const px = (charWidth: number) => Math.round(charWidth * 7) + 5;

function imageExtension(dataUrl: string): 'png' | 'jpeg' {
  return /^data:image\/jpe?g/.test(dataUrl) ? 'jpeg' : 'png';
}

/** Lee ancho y alto del bloque IHDR de un PNG en base64. */
function pngSize(dataUrl: string): { width: number; height: number } | undefined {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return undefined;
  try {
    const head = atob(base64.slice(0, 64));
    if (head.slice(1, 4) !== 'PNG') return undefined;
    const readUint32 = (offset: number) =>
      ((head.charCodeAt(offset) << 24) |
        (head.charCodeAt(offset + 1) << 16) |
        (head.charCodeAt(offset + 2) << 8) |
        head.charCodeAt(offset + 3)) >>> 0;
    return { width: readUint32(16), height: readUint32(20) };
  } catch {
    return undefined;
  }
}

/**
 * Reparte `count` bloques sobre columnas de ancho desigual buscando que queden
 * lo más parejos posible: elige la partición contigua que minimiza la
 * desviación máxima respecto del ancho ideal.
 */
function balancedSpans(colWidths: number[], count: number): number[] {
  const cols = colWidths.length;
  if (count <= 1) return [cols];
  if (count >= cols) return Array.from({ length: count }, () => 1);

  const ideal = colWidths.reduce((a, b) => a + b, 0) / count;
  let best: number[] = [];
  let bestScore = Infinity;

  const walk = (start: number, remaining: number, spans: number[], worst: number) => {
    if (worst >= bestScore) return;
    if (remaining === 1) {
      const width = colWidths.slice(start).reduce((a, b) => a + b, 0);
      const score = Math.max(worst, Math.abs(width - ideal));
      if (score < bestScore) {
        bestScore = score;
        best = [...spans, cols - start];
      }
      return;
    }
    const maxSpan = cols - start - (remaining - 1);
    let width = 0;
    for (let span = 1; span <= maxSpan; span++) {
      width += colWidths[start + span - 1];
      walk(start + span, remaining - 1, [...spans, span], Math.max(worst, Math.abs(width - ideal)));
    }
  };

  walk(0, count, [], 0);
  return best;
}

export async function exportToXlsx({
  filename,
  title,
  subtitle,
  kpis,
  columns,
  rows,
  showTotals = false,
  rowColorFn,
  logoBase64,
  chartImageBase64,
}: ExportPayload) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FinSightAI';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reporte', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const tableCols = columns.length;
  const gridCols = Math.max(tableCols, kpis.length);
  const lastGridCol = FIRST_COL + gridCols - 1;
  const lastTableCol = FIRST_COL + tableCols - 1;

  // --- Anchos de columna ---
  sheet.getColumn(1).width = GUTTER_WIDTH;
  const widths: number[] = [];
  columns.forEach((col, idx) => {
    const widest = rows.reduce(
      (max, row) => Math.max(max, formatCell(row[idx], col.type).length),
      col.header.length
    );
    widths[idx] = Math.min(Math.max(widest + 6, 14), 52);
  });
  for (let i = tableCols; i < gridCols; i++) widths[i] = 16;

  // Un informe angosto con un gráfico ancho se ve descalibrado: se estiran las
  // columnas proporcionalmente hasta un ancho mínimo de página.
  const naturalWidth = widths.reduce((a, b) => a + b, 0);
  if (naturalWidth < MIN_REPORT_WIDTH) {
    const factor = MIN_REPORT_WIDTH / naturalWidth;
    for (let i = 0; i < widths.length; i++) widths[i] = Math.min(widths[i] * factor, 60);
  }
  widths.forEach((w, i) => {
    sheet.getColumn(FIRST_COL + i).width = w;
  });

  const reportWidthPx = widths.reduce((acc, w) => acc + px(w), 0);

  const styleRange = (row: number, from: number, to: number, apply: (c: ExcelJS.Cell) => void) => {
    for (let c = from; c <= to; c++) apply(sheet.getCell(row, c));
  };

  let cursor = 1;

  // --- Membrete ---
  if (logoBase64) {
    const imageId = workbook.addImage({
      base64: logoBase64,
      extension: imageExtension(logoBase64),
    });
    sheet.addImage(imageId, {
      tl: { col: FIRST_COL - 1, row: cursor - 1 },
      ext: { width: 120, height: 44 },
    });
  }
  sheet.getRow(cursor).height = 38;
  cursor += 2;

  sheet.mergeCells(cursor, FIRST_COL, cursor, lastGridCol);
  const titleCell = sheet.getCell(cursor, FIRST_COL);
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 20, bold: true, color: { argb: INK } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(cursor).height = 28;
  cursor += 1;

  sheet.mergeCells(cursor, FIRST_COL, cursor, lastGridCol);
  const subtitleCell = sheet.getCell(cursor, FIRST_COL);
  subtitleCell.value = subtitle
    ? `${subtitle}  ·  ${fechaGeneracion()}`
    : fechaGeneracion();
  subtitleCell.font = { name: FONT, size: 10, color: { argb: MUTED } };
  subtitleCell.alignment = { vertical: 'middle' };
  sheet.getRow(cursor).height = 18;
  cursor += 1;

  // Regla fina en lugar de una banda de color: el acento va en los KPI.
  styleRange(cursor, FIRST_COL, lastGridCol, (cell) => {
    cell.border = { bottom: { style: 'thin', color: { argb: INK } } };
  });
  sheet.getRow(cursor).height = 6;
  cursor += 2;

  // --- KPIs: etiqueta arriba, cifra grande abajo, filete de color como acento ---
  if (kpis.length) {
    const labelRow = cursor;
    const valueRow = cursor + 1;
    const accentRow = cursor + 2;
    const spans = balancedSpans(widths.slice(0, gridCols), kpis.length);

    let col = FIRST_COL;
    kpis.forEach((kpi, idx) => {
      const endCol = col + spans[idx] - 1;

      sheet.mergeCells(labelRow, col, labelRow, endCol);
      const labelCell = sheet.getCell(labelRow, col);
      labelCell.value = kpi.label.toUpperCase();
      labelCell.font = { name: FONT, size: 9, bold: true, color: { argb: MUTED } };
      labelCell.alignment = { vertical: 'middle' };

      sheet.mergeCells(valueRow, col, valueRow, endCol);
      const valueCell = sheet.getCell(valueRow, col);
      valueCell.value = kpi.value;
      valueCell.font = { name: FONT, size: 20, bold: true, color: { argb: INK } };
      valueCell.alignment = { vertical: 'middle' };

      // El filete sólo cubre la primera columna de cada bloque: marca sin saturar.
      const accentCell = sheet.getCell(accentRow, col);
      accentCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ACCENT[kpi.color] ?? ACCENT.brand },
      };

      col = endCol + 1;
    });

    sheet.getRow(labelRow).height = 16;
    sheet.getRow(valueRow).height = 30;
    sheet.getRow(accentRow).height = 3;
    cursor += 4;
  }

  // --- Gráfico, escalado al ancho real del informe ---
  if (chartImageBase64) {
    const natural = pngSize(chartImageBase64);
    const aspect = natural ? natural.height / natural.width : 0.4;
    const width = reportWidthPx;
    const height = Math.round(width * aspect);

    const imageId = workbook.addImage({
      base64: chartImageBase64,
      extension: imageExtension(chartImageBase64),
    });
    sheet.addImage(imageId, {
      tl: { col: FIRST_COL - 1, row: cursor - 1 },
      ext: { width, height },
    });

    const filas = Math.ceil(height / 20);
    for (let r = cursor; r < cursor + filas; r++) sheet.getRow(r).height = 20;
    cursor += filas + 2;
  }

  // --- Encabezado de tabla: sin relleno, tipografía chica y regla marcada ---
  const headerRowIdx = cursor;
  const headerRow = sheet.getRow(headerRowIdx);
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(FIRST_COL + idx);
    cell.value = col.header.toUpperCase();
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: MUTED } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: isNumericType(col.type) ? 'right' : 'left',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: INK } } };
  });
  headerRow.height = 22;
  cursor += 1;

  // --- Filas: sin cebra, separadas por hairlines ---
  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(cursor);
    const semantic = rowColorFn?.(rowIndex);

    columns.forEach((col, colIdx) => {
      const cell = excelRow.getCell(FIRST_COL + colIdx);
      const raw = row[colIdx];

      if (isNumericType(col.type) && raw !== '' && !Number.isNaN(Number(raw))) {
        cell.value = Number(raw);
        const fmt = excelNumFmt(col.type);
        if (fmt) cell.numFmt = fmt;
      } else {
        cell.value = raw ?? '';
      }

      // El color sólo tiñe la cifra, nunca el fondo de la fila.
      const numeric = isNumericType(col.type);
      const semanticInk = semantic === 'success' ? 'FF039855' : 'FFD92D20';
      cell.font = {
        name: FONT,
        size: 10.5,
        color: { argb: semantic && numeric ? semanticInk : INK },
      };
      cell.alignment = { vertical: 'middle', horizontal: numeric ? 'right' : 'left' };
      cell.border = { bottom: { style: 'thin', color: { argb: HAIRLINE } } };
    });

    excelRow.height = 21;
    cursor += 1;
  });

  // --- Totales ---
  const sumables = columns
    .map((col, idx) => ({ col, idx }))
    .filter(({ col }) => col.type === 'currency' || col.type === 'number' || col.type === 'percent');

  if (showTotals && rows.length > 1 && sumables.length) {
    const totalRow = sheet.getRow(cursor);
    columns.forEach((col, colIdx) => {
      const cell = totalRow.getCell(FIRST_COL + colIdx);
      cell.font = { name: FONT, size: 10.5, bold: true, color: { argb: INK } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: isNumericType(col.type) ? 'right' : 'left',
      };
      cell.border = { top: { style: 'medium', color: { argb: INK } } };

      if (colIdx === 0) {
        cell.value = 'TOTAL';
      } else if (sumables.some((s) => s.idx === colIdx)) {
        cell.value = rows.reduce((acc, row) => acc + (Number(row[colIdx]) || 0), 0);
        const fmt = excelNumFmt(col.type);
        if (fmt) cell.numFmt = fmt;
      }
    });
    totalRow.height = 24;
    cursor += 1;
  }

  sheet.views = [{ state: 'frozen', ySplit: headerRowIdx, showGridLines: false }];
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: headerRowIdx, column: FIRST_COL },
      to: { row: headerRowIdx, column: lastTableCol },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filename}.xlsx`
  );
}
