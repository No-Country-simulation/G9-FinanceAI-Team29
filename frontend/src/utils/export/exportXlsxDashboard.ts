import JSZip from 'jszip';
import { saveBlob } from './downloadBlob';
import type { Transaccion } from '../../types/finance';

const TEMPLATE_URL = '/templates/dashboard-financiero-base.xlsx';
const SHEET_DETALLE = 'xl/worksheets/sheet2.xml';
const SHEET_DASHBOARD = 'xl/worksheets/sheet1.xml';

const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Las 6 columnas de categoría de la plantilla; el resto de las categorías reales se suma en "Otros". */
const CATEGORY_SLOTS: Record<string, 'H' | 'I' | 'J' | 'K' | 'L' | 'M'> = {
  Alimentación: 'H',
  Vivienda: 'I',
  Transporte: 'J',
  Servicios: 'K',
  Salud: 'L',
};
const OTROS_COLUMN = 'M';

interface MonthRow {
  label: string;
  ingresoAcumuladoAnterior: number;
  ingresoDelMes: number;
  categorias: Record<'H' | 'I' | 'J' | 'K' | 'L' | 'M', number>;
  totalGastos: number;
  balance: number;
}

function monthKey(fecha: string): string {
  return fecha.slice(0, 7); // "YYYY-MM"
}

function buildMonthRows(transacciones: Transaccion[]): MonthRow[] {
  const now = new Date();
  const conFecha = transacciones.filter((t) => !!t.fecha);
  const ultima = conFecha.reduce<Date | null>((max, t) => {
    const d = new Date(t.fecha);
    return !max || d > max ? d : max;
  }, null);
  const anchor = ultima ?? now;

  const months: { year: number; month: number; key: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  }

  const windowStart = new Date(months[0].year, months[0].month, 1);

  const ingresoAcumuladoAntes = transacciones
    .filter((t) => t.tipo === 'Ingreso' && new Date(t.fecha) < windowStart)
    .reduce((acc, t) => acc + Number(t.monto), 0);

  let acumulado = ingresoAcumuladoAntes;

  return months.map(({ year, month, key }) => {
    const delMes = transacciones.filter((t) => monthKey(t.fecha) === key);
    const ingresoDelMes = delMes
      .filter((t) => t.tipo === 'Ingreso')
      .reduce((acc, t) => acc + Number(t.monto), 0);

    const categorias: MonthRow['categorias'] = { H: 0, I: 0, J: 0, K: 0, L: 0, M: 0 };
    delMes
      .filter((t) => t.tipo === 'Gasto')
      .forEach((t) => {
        const slot = CATEGORY_SLOTS[t.categoria] ?? OTROS_COLUMN;
        categorias[slot] += Number(t.monto);
      });

    const totalGastos = Object.values(categorias).reduce((a, b) => a + b, 0);
    const ingresoAcumuladoAnterior = acumulado;
    acumulado += ingresoDelMes;

    return {
      label: `${MESES[month]} ${year}`,
      ingresoAcumuladoAnterior,
      ingresoDelMes,
      categorias,
      totalGastos,
      balance: ingresoDelMes - totalGastos,
    };
  });
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Matchea tanto `<c r="X".../>` (celda vacía) como `<c r="X"...>...</c>`. */
function cellRegex(ref: string): RegExp {
  return new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
}

function setCellNumber(xml: string, ref: string, value: number): string {
  return xml.replace(cellRegex(ref), (_full, attrs: string) => {
    const cleanAttrs = attrs.replace(/\st="[^"]*"/, '');
    const safe = Number.isFinite(value) ? value : 0;
    return `<c r="${ref}"${cleanAttrs}><v>${safe}</v></c>`;
  });
}

function setCellInlineString(xml: string, ref: string, text: string): string {
  return xml.replace(cellRegex(ref), (_full, attrs: string) => {
    const cleanAttrs = attrs.replace(/\st="[^"]*"/, '');
    return `<c r="${ref}"${cleanAttrs} t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
  });
}

export async function exportDashboardXlsx(transacciones: Transaccion[], filename: string) {
  const templateRes = await fetch(TEMPLATE_URL, { cache: 'no-store' });
  if (!templateRes.ok) throw new Error('No se pudo cargar la plantilla del dashboard.');
  const templateBuf = await templateRes.arrayBuffer();

  const zip = await JSZip.loadAsync(templateBuf);
  const rows = buildMonthRows(transacciones);

  let detalle = await zip.file(SHEET_DETALLE)!.async('string');
  const firstYear = rows[0].label.slice(-4);
  const lastYear = rows[rows.length - 1].label.slice(-4);
  detalle = setCellInlineString(detalle, 'B2', firstYear === lastYear ? firstYear : `${firstYear}-${lastYear}`);
  rows.forEach((row, i) => {
    const r = 5 + i;
    detalle = setCellInlineString(detalle, `A${r}`, row.label);
    detalle = setCellNumber(detalle, `B${r}`, row.ingresoAcumuladoAnterior);
    detalle = setCellNumber(detalle, `C${r}`, row.ingresoDelMes);
    detalle = setCellNumber(detalle, `G${r}`, row.balance);
    (Object.keys(row.categorias) as (keyof MonthRow['categorias'])[]).forEach((col) => {
      detalle = setCellNumber(detalle, `${col}${r}`, row.categorias[col]);
    });
  });
  zip.file(SHEET_DETALLE, detalle);

  const mesMayorIngreso = rows.reduce((max, row) => (row.ingresoDelMes > max.ingresoDelMes ? row : max), rows[0]);
  let dashboard = await zip.file(SHEET_DASHBOARD)!.async('string');
  dashboard = setCellInlineString(dashboard, 'Q24', mesMayorIngreso.label);
  zip.file(SHEET_DASHBOARD, dashboard);

  // jszip agrega entradas de carpeta sintéticas ("xl/", "xl/worksheets/", ...) al sobrescribir
  // archivos anidados con zip.file(). Un .xlsx real nunca las tiene, y Excel 2016 las interpreta
  // como paquete dañado (pide reparar), así que se eliminan antes de generar el archivo final.
  // OJO: zip.remove(path) en una carpeta borra en cascada todo lo que contiene; hay que borrar
  // solo la entrada del diccionario interno.
  Object.keys(zip.files)
    .filter((path) => zip.files[path].dir)
    .forEach((path) => {
      delete zip.files[path];
    });

  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  saveBlob(out, `${filename}.xlsx`);
}
