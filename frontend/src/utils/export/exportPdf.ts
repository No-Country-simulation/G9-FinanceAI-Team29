import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveBlob } from './downloadBlob';
import { EXPORT_COLORS } from './theme';
import { fechaGeneracion, formatCell, isNumericType } from './format';
import type { ExportPayload } from './types';

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

const C = {
  ink: hexToRgb(EXPORT_COLORS.textDark),
  muted: hexToRgb(EXPORT_COLORS.gray),
  hairline: hexToRgb('#EAECF0'),
  white: [255, 255, 255] as RGB,
  successInk: hexToRgb('#039855'),
  errorInk: hexToRgb('#D92D20'),
};

const ACCENT: Record<string, RGB> = {
  brand: hexToRgb(EXPORT_COLORS.brand),
  success: hexToRgb(EXPORT_COLORS.success),
  error: hexToRgb(EXPORT_COLORS.error),
};

const MARGIN = 44;
const CHART_MAX_HEIGHT = 150;

export function exportToPdf({
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
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  let y = MARGIN;

  // --- Membrete ---
  let textX = MARGIN;
  if (logoBase64) {
    try {
      const props = doc.getImageProperties(logoBase64);
      const logoHeight = 34;
      const logoWidth = (props.width / props.height) * logoHeight;
      doc.addImage(logoBase64, 'PNG', MARGIN, y, logoWidth, logoHeight);
      textX = MARGIN + logoWidth + 18;
    } catch {
      // Sin logo el membrete sigue siendo válido.
    }
  }

  doc.setTextColor(...C.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(title, textX, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(subtitle ? `${subtitle}  ·  ${fechaGeneracion()}` : fechaGeneracion(), textX, y + 31);

  y += 46;
  doc.setDrawColor(...C.ink);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 26;

  // --- KPIs: etiqueta, cifra grande y filete de color. Sin cajas de fondo. ---
  if (kpis.length) {
    const slot = contentWidth / kpis.length;

    kpis.forEach((kpi, idx) => {
      const x = MARGIN + idx * slot;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text(kpi.label.toUpperCase(), x, y, { charSpace: 0.7 });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(21);
      doc.setTextColor(...C.ink);
      doc.text(kpi.value, x, y + 24);

      const anchoFilete = Math.min(doc.getTextWidth(kpi.value) + 6, slot - 18);
      doc.setFillColor(...(ACCENT[kpi.color] ?? ACCENT.brand));
      doc.rect(x, y + 32, anchoFilete, 2.5, 'F');
    });

    y += 56;
  }

  // --- Gráfico, acotado para que la tabla no se parta de más ---
  if (chartImageBase64) {
    try {
      const props = doc.getImageProperties(chartImageBase64);
      let width = contentWidth;
      let height = (props.height / props.width) * width;
      if (height > CHART_MAX_HEIGHT) {
        height = CHART_MAX_HEIGHT;
        width = (props.width / props.height) * height;
      }
      doc.addImage(chartImageBase64, 'PNG', MARGIN, y, width, height);
      y += height + 26;
    } catch {
      // Si el gráfico falla, el informe sigue completo.
    }
  }

  // --- Tabla ---
  const head = [columns.map((col) => col.header.toUpperCase())];
  const body = rows.map((row) => row.map((value, idx) => formatCell(value, columns[idx]?.type)));

  const sumables = columns
    .map((col, idx) => ({ col, idx }))
    .filter(({ col }) => col.type === 'currency' || col.type === 'number' || col.type === 'percent');

  const foot =
    showTotals && rows.length > 1 && sumables.length
      ? [
          columns.map((col, colIdx) => {
            if (colIdx === 0) return 'TOTAL';
            if (!sumables.some((s) => s.idx === colIdx)) return '';
            const suma = rows.reduce((acc, row) => acc + (Number(row[colIdx]) || 0), 0);
            return formatCell(suma, col.type);
          }),
        ]
      : undefined;

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    theme: 'plain',
    // Sin esto el total se repite al pie de cada página.
    showFoot: 'lastPage',
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 20 },
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: C.ink,
      cellPadding: { top: 6, bottom: 6, left: 2, right: 2 },
      lineColor: C.hairline,
      lineWidth: { bottom: 0.5 },
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8,
      textColor: C.muted,
      lineColor: C.ink,
      lineWidth: { bottom: 0.8 },
    },
    footStyles: {
      fontStyle: 'bold',
      fontSize: 9.5,
      textColor: C.ink,
      lineColor: C.ink,
      lineWidth: { top: 0.8, bottom: 0 },
    },
    didParseCell: (data) => {
      const col = columns[data.column.index];

      // headStyles pisa columnStyles, así que la alineación se fija acá para
      // las tres secciones: si no, los títulos numéricos quedan a la izquierda
      // y los números a la derecha, sin coincidir con su columna.
      data.cell.styles.halign = isNumericType(col?.type) ? 'right' : 'left';

      if (data.section === 'body') {
        const semantic = rowColorFn?.(data.row.index);
        if (semantic && isNumericType(col?.type)) {
          data.cell.styles.textColor = semantic === 'success' ? C.successInk : C.errorInk;
        }
      }
    },
  });

  // --- Pie ---
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...C.hairline);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, pageHeight - MARGIN - 6, pageWidth - MARGIN, pageHeight - MARGIN - 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('FinSightAI', MARGIN, pageHeight - MARGIN + 6);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - MARGIN, pageHeight - MARGIN + 6, {
      align: 'right',
    });
  }

  saveBlob(doc.output('blob'), `${filename}.pdf`);
}
