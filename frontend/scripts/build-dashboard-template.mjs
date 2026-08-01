// Genera frontend/public/templates/dashboard-financiero-base.xlsx a partir de la plantilla
// original de attrition (Attrition-Analysis-Spreadsheet-Dashboard-Template.xlsx).
//
// Traduce títulos y encabezados a términos financieros, recolorea los 4 gráficos nativos
// con la paleta de marca, vacía las secciones específicas de RR.HH. sin equivalente real
// en la app (género, motivo de baja), y fuerza el recálculo al abrir en Excel.
//
// Uso: node scripts/build-dashboard-template.mjs
//
// El runtime (exportXlsxTemplate.ts) parte de este archivo base y solo inyecta los
// valores mensuales reales; nunca vuelve a tocar textos ni colores.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.resolve(__dirname, 'source/attrition-dashboard-template-original.xlsx');
const OUT_DIR = path.resolve(__dirname, '../public/templates');
const OUT_FILE = path.join(OUT_DIR, 'dashboard-financiero-base.xlsx');
const LOGO_FILE = path.resolve(__dirname, '../public/logo.png');
const FINSIGHT_URL = 'https://g9-finance-ai-team29-git-main-guilles-projects-b3249b32.vercel.app/';

// index del shared string -> nuevo texto de cada <t> del <si>, en orden.
// Un solo string en el array = <si> de un único <t>. Varios = <si> multi-run (mismo orden de <r>).
const STRING_MAP = {
  0: ['Dashboard ', 'Financiero'],
  1: ['Resumen financiero del período'],
  2: ['Dashboard'],
  3: ['Detalle'],
  4: ['Categorías'],
  5: ['Ingreso Acum. Anterior'],
  6: ['Ingresos del Mes'],
  7: ['Ingreso Acumulado Total'],
  8: ['Ingreso Acum. Promedio'],
  9: ['% Gasto / Ingreso Acum.'],
  10: ['Balance Anual'],
  11: ['del período'],
  12: ['  ', 'Evolución', ' ', '%', ' Gasto / Ingreso'],
  13: ['•   ', '% mensual'],
  14: ['   Muestra el % de gasto mensual sobre el ingreso acumulado, mes a mes'],
  15: ['fue el mes con mayores ingresos.'],
  16: ['Ingreso Acum. Inicial'],
  17: ['', ''],
  18: ['  ', 'Ingresos vs. ', 'Gastos por Mes'],
  19: ['   Muestra la comparación entre ingresos y gastos a lo largo del año.'],
  20: ['🔵'],
  21: ['Ingresos'],
  22: ['🟠'],
  23: ['Gastos'],
  24: ['MES'],
  25: ['TOTAL DE GASTOS'],
  26: [''],
  27: [''],
  28: [''],
  29: [''],
  30: ['', ''],
  31: ['© ', ' ', 'FinSightAI'],
  32: ['DETALLE MENSUAL'],
  33: ['AÑO'],
  34: ['DETALLE'],
  35: ['GASTO POR CATEGORÍA'],
  36: ['Mes'],
  37: ['Ingreso Acumulado (mes anterior)'],
  38: ['Ingreso Acumulado (fin de mes)'],
  39: ['Ingreso Acumulado Promedio'],
  40: ['% Gasto / Ingreso Acum.\n', '(Gasto del Mes / Ingreso Acum. Promedio)*100'],
  41: ['Alimentación'],
  42: ['Vivienda'],
  43: ['Transporte'],
  44: ['Servicios'],
  45: ['Salud'],
  46: ['Otros'],
  47: ['Total Gastos del Mes'],
  48: ['Enero'],
  49: ['Febrero'],
  50: ['Marzo'],
  51: ['Abril'],
  52: ['Mayo'],
  53: ['Junio'],
  54: ['Julio'],
  55: ['Agosto'],
  56: ['Septiembre'],
  57: ['Octubre'],
  58: ['Noviembre'],
  59: ['Diciembre'],
  60: ['TOTAL / PROMEDIO'],
  61: ['CATEGORÍAS Y RESUMEN'],
  62: ['RESUMEN FINANCIERO'],
  63: ['GASTOS MENSUALES DEL PERÍODO'],
  64: ['Ingresos del Año'],
  65: [''],
  66: ['Gastos del Año'],
  67: [''],
  68: ['Balance Anual'],
  69: [''],
  70: ['Ingreso Acum. Promedio'],
  71: ['% Gasto / Ingreso Prom.'],
  72: [''],
  73: [''],
};

// Paleta de marca (frontend/src/utils/export/theme.ts) reemplazando los acentos
// hardcodeados del template original. Los neutros (negros/grises/blancos) se dejan igual.
const COLOR_MAP = {
  F09D65: '465FFF', // acento principal (naranja) -> brand
  '27A7B4': '12B76A', // acento secundario (teal) -> success
};
const SCHEME_TO_LITERAL = {
  // accent5 del theme original resuelve a naranja; se reemplaza por un srgbClr literal de marca.
  '<a:schemeClr val="accent5"/>': '<a:srgbClr val="465FFF"/>',
};

function replaceSharedStrings(xml) {
  const items = [...xml.matchAll(/<si>.*?<\/si>/gs)];
  let out = xml;
  items.forEach((m, idx) => {
    const mapping = STRING_MAP[idx];
    if (!mapping) return;
    const si = m[0];
    let runIdx = 0;
    const newSi = si.replace(/(<t[^>]*>)(.*?)(<\/t>)/gs, (_full, open, _inner, close) => {
      const text = mapping[runIdx] ?? '';
      runIdx += 1;
      return open + escapeXml(text) + close;
    });
    out = out.replace(si, newSi);
  });
  return out;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function recolorChart(xml) {
  let out = xml;
  for (const [from, to] of Object.entries(COLOR_MAP)) {
    out = out.replaceAll(`srgbClr val="${from}"`, `srgbClr val="${to}"`);
  }
  for (const [from, to] of Object.entries(SCHEME_TO_LITERAL)) {
    out = out.replaceAll(from, to);
  }
  return out;
}

function cellRegex(ref) {
  return new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
}

/** Reemplaza una celda por una fórmula (con valor cacheado) que apunta a la hoja de detalle. */
function setCellFormula(xml, ref, formula, cachedValue, { isString = false } = {}) {
  return xml.replace(cellRegex(ref), (_full, attrs) => {
    const cleanAttrs = attrs.replace(/\st="[^"]*"/, '');
    const typeAttr = isString ? ' t="str"' : '';
    return `<c r="${ref}"${cleanAttrs}${typeAttr}><f>${formula}</f><v>${cachedValue}</v></c>`;
  });
}

// Demographics!B4:C11 (género) y E4:F13 (motivo de baja) son secciones de RR.HH. sin
// equivalente real en la app. En vez de dejarlas vacías (cajas en blanco / "0" visibles en el
// Dashboard, que además dejan celdas huérfanas sin fórmula), se reciclan con fórmulas que leen
// la hoja "Attrition Details" (Detalle) real: B4:C9 se convierte en un mini resumen anual
// (ingresos, gastos, balance) y E4:F13 (que alimenta la lista visible del Dashboard en
// M58:Q67) pasa a mostrar el gasto total de los primeros 10 meses del período.
function fillDemographicsWithFinanceData(xml) {
  let out = xml;

  const summary = [
    ['C4', "'Attrition Details'!C17", 90],
    ['C5', "'Attrition Details'!N17", 74],
    ['C7', "'Attrition Details'!G17", 197000],
    ['C8', "'Attrition Details'!E17", 116.75],
    ['C9', "'Attrition Details'!F17*100", 5.27],
  ];
  summary.forEach(([ref, formula, cached]) => {
    out = setCellFormula(out, ref, formula, cached);
  });

  for (let i = 0; i < 10; i++) {
    const detalleRow = 5 + i;
    const demoRow = 4 + i;
    out = setCellFormula(out, `E${demoRow}`, `'Attrition Details'!A${detalleRow}`, 'Mes', { isString: true });
    out = setCellFormula(out, `F${demoRow}`, `'Attrition Details'!N${detalleRow}`, 0);
  }

  return out;
}

function forceRecalcOnLoad(xml) {
  return xml.replace(/<calcPr calcId="\d+"\/>/, (m) => m.replace('/>', ' fullCalcOnLoad="1"/>'));
}

// El template original de attrition quedó marcado por Excel como "recuperado" en algún momento
// (fileRecoveryPr repairLoad="1"), lo que hace que Excel muestre el aviso "encontramos un
// problema con el contenido... ¿recuperar?" cada vez que se abre CUALQUIER archivo clonado de
// esta plantilla, aunque el contenido esté sano. Se elimina la marca en el archivo base para que
// no se propague a los dashboards generados.
function removeRepairFlag(xml) {
  return xml.replace(/<fileRecoveryPr[^/]*\/>/, '');
}

// Los KPI fueron disenados para enteros cortos. Al mostrar moneda, millares y centavos sus
// fuentes originales (29, 34 y 72 pt) provocan ###. Se ajustan solo las fuentes de valores.
function resizeDashboardKpiFonts(stylesXml) {
  const fontsMatch = stylesXml.match(/<fonts\b[^>]*>[\s\S]*?<\/fonts>/);
  if (!fontsMatch) throw new Error('styles.xml: no se encontro la coleccion de fuentes');

  const fonts = [...fontsMatch[0].matchAll(/<font>[\s\S]*?<\/font>/g)];
  const sizes = new Map([
    [7, [34, 18]],  // cuatro KPI superiores
    [20, [29, 12]], // ingreso acumulado inicial, panel circular
    [21, [29, 12]], // ingreso acumulado total, panel circular
    [40, [22, 18]], // balance anual superior
    [42, [72, 32]], // ingreso maximo del panel oscuro
  ]);

  let out = stylesXml;
  for (const [fontId, [from, to]] of sizes) {
    const target = fonts[fontId]?.[0];
    if (!target || !target.includes(`<sz val="${from}"/>`)) {
      throw new Error(`styles.xml: no se encontro la fuente ${fontId} de ${from} pt`);
    }
    out = out.replace(target, target.replace(`<sz val="${from}"/>`, `<sz val="${to}"/>`));
  }
  return out;
}

const CURRENCY_FORMAT = '&quot;$&quot;#,##0.00';
const PERCENT_NUMBER_FORMAT = '0.00&quot;%&quot;';

function withCurrencyNumberFormat(xf) {
  let formatted = xf.replace(/numFmtId="\d+"/, 'numFmtId="164"');
  if (!formatted.includes('applyNumberFormat=')) {
    formatted = formatted.replace('<xf ', '<xf applyNumberFormat="1" ');
  }
  return formatted;
}

function withNumberFormat(xf, numFmtId) {
  let formatted = xf.replace(/numFmtId="\d+"/, `numFmtId="${numFmtId}"`);
  if (!formatted.includes('applyNumberFormat=')) {
    formatted = formatted.replace('<xf ', '<xf applyNumberFormat="1" ');
  }
  return formatted;
}

function withStyleAttributes(xf, attributes) {
  let styled = xf;
  for (const [name, value] of Object.entries(attributes)) {
    const attribute = new RegExp(`${name}="[^"]*"`);
    styled = attribute.test(styled)
      ? styled.replace(attribute, `${name}="${value}"`)
      : styled.replace('<xf ', `<xf ${name}="${value}" `);
  }
  return styled;
}

// Aplica moneda solo a estilos que representan importes. Las celdas mixtas de la hoja
// Categorias reciben variantes nuevas para no convertir tambien los nombres de mes en moneda.
function addCurrencyFormats(stylesXml) {
  let out = stylesXml.replace(
    /<numFmt numFmtId="164" formatCode="[^"]*"\/>/,
    () => `<numFmt numFmtId="164" formatCode="${CURRENCY_FORMAT}"/>`,
  );
  out = out.replace(/<numFmts count="1">/, '<numFmts count="2">');
  out = out.replace(
    '</numFmts>',
    `<numFmt numFmtId="165" formatCode="${PERCENT_NUMBER_FORMAT}"/></numFmts>`,
  );

  const bordersMatch = out.match(/<borders\b[^>]*>[\s\S]*?<\/borders>/);
  if (!bordersMatch) throw new Error('styles.xml: no se encontro borders');
  const borderCount = Number(bordersMatch[0].match(/count="(\d+)"/)?.[1]);
  if (!Number.isFinite(borderCount)) throw new Error('styles.xml: count de borders invalido');
  const tableBorder = '<border><left style="thin"><color rgb="FFE6E9EF"/></left>'
    + '<right style="thin"><color rgb="FFE6E9EF"/></right>'
    + '<top style="thin"><color rgb="FFE6E9EF"/></top>'
    + '<bottom style="thin"><color rgb="FFE6E9EF"/></bottom><diagonal/></border>';
  const rebuiltBorders = bordersMatch[0]
    .replace(/count="\d+"/, `count="${borderCount + 1}"`)
    .replace('</borders>', `${tableBorder}</borders>`);
  out = out.replace(bordersMatch[0], rebuiltBorders);

  const cellXfsMatch = out.match(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/);
  if (!cellXfsMatch) throw new Error('styles.xml: no se encontro cellXfs');
  const block = cellXfsMatch[0];
  const styles = [...block.matchAll(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)]
    .map((match) => match[0]);

  const directCurrencyStyles = [31, 32, 34, 35, 36, 38, 39, 41, 64, 65, 66, 84, 85, 93, 94, 96];
  directCurrencyStyles.forEach((styleId) => {
    if (!styles[styleId]) throw new Error(`styles.xml: no existe el estilo ${styleId}`);
    styles[styleId] = withCurrencyNumberFormat(styles[styleId]);
  });

  const categoryStyleMap = {};
  [54, 56].forEach((styleId) => {
    if (!styles[styleId]) throw new Error(`styles.xml: no existe el estilo ${styleId}`);
    categoryStyleMap[styleId] = styles.length;
    styles.push(withCurrencyNumberFormat(styles[styleId]));
  });
  const categoryPercentageStyle = styles.length;
  styles.push(withNumberFormat(styles[56], 165));

  const dashboardTableStyles = {
    header: styles.length,
    month: styles.length + 1,
    amount: styles.length + 2,
  };
  styles.push(withStyleAttributes(styles[60], {
    fontId: 17,
    fillId: 7,
    borderId: borderCount,
    applyFont: 1,
    applyFill: 1,
    applyBorder: 1,
  }));
  styles.push(withStyleAttributes(styles[61], {
    fillId: 3,
    borderId: borderCount,
    applyFill: 1,
    applyBorder: 1,
  }));
  styles.push(withStyleAttributes(styles[64], {
    fillId: 3,
    borderId: borderCount,
    applyFill: 1,
    applyBorder: 1,
  }));

  const opening = block.match(/^<cellXfs\b[^>]*>/)?.[0];
  if (!opening) throw new Error('styles.xml: apertura de cellXfs invalida');
  const rebuilt = `${opening.replace(/count="\d+"/, `count="${styles.length}"`)}${styles.join('')}</cellXfs>`;
  out = out.replace(block, rebuilt);
  return { xml: out, categoryStyleMap, categoryPercentageStyle, dashboardTableStyles };
}

function applyCategoryCurrencyStyles(xml, styleMap, percentageStyle) {
  const refs = [
    'C4', 'C5', 'C8',
    ...Array.from({ length: 10 }, (_, index) => `F${4 + index}`),
    ...Array.from({ length: 6 }, (_, index) => `C${12 + index}`),
  ];

  let out = xml;
  refs.forEach((ref) => {
    out = out.replace(new RegExp(`<c r="${ref}" s="(54|56)"`), (_match, styleId) => {
      return `<c r="${ref}" s="${styleMap[Number(styleId)]}"`;
    });
  });
  out = out.replace(/<c r="C9" s="56"/, `<c r="C9" s="${percentageStyle}"`);
  return out;
}

function setWorksheetColumnWidths(sheet2Xml, sheet3Xml) {
  const detailRange = '<col min="2" max="14" width="15.140625" customWidth="1"/>';
  if (!sheet2Xml.includes(detailRange)) {
    throw new Error('sheet2.xml: no se encontro el ancho agrupado B:N');
  }
  const detail = sheet2Xml.replace(
    detailRange,
    '<col min="2" max="5" width="15.140625" customWidth="1"/>'
      + '<col min="6" max="6" width="28.2890625" customWidth="1"/>'
      + '<col min="7" max="14" width="15.140625" customWidth="1"/>',
  );

  const categoryColumn = '<col min="2" max="2" width="20.42578125" customWidth="1"/>';
  if (!sheet3Xml.includes(categoryColumn)) {
    throw new Error('sheet3.xml: no se encontro el ancho original de la columna B');
  }
  const categories = sheet3Xml.replace(
    categoryColumn,
    '<col min="2" max="2" width="25.85546875" customWidth="1"/>',
  );

  return { detail, categories };
}

function resizeDashboardFooterAndMergeLogoArea(xml) {
  let out = xml.replace(/<row r="80"([^>]*)>/, (_match, attrs) => {
    let resized = attrs.replace(/\sht="[^"]*"/, ' ht="54.75"');
    if (!resized.includes(' customHeight=')) resized += ' customHeight="1"';
    return `<row r="80"${resized}>`;
  });
  if (out === xml) throw new Error('sheet1.xml: no se encontro la fila 80');

  if (!out.includes('<mergeCells')) throw new Error('sheet1.xml: no se encontro mergeCells');
  if (!out.includes('<mergeCell ref="J3:L5"/>')) {
    out = out.replace(/<mergeCells count="(\d+)">/, (_match, count) => {
      return `<mergeCells count="${Number(count) + 1}">`;
    });
    out = out.replace('</mergeCells>', '<mergeCell ref="J3:L5"/></mergeCells>');
  }
  return out;
}

function applyDashboardExpenseTableStyles(xml, styles) {
  const columnNumber = (letters) => letters.split('').reduce(
    (value, letter) => value * 26 + letter.charCodeAt(0) - 64,
    0,
  );
  return xml.replace(/<c r="([A-Z]+)(\d+)"(?: s="\d+")?/g, (match, col, rowText) => {
    const row = Number(rowText);
    const column = columnNumber(col);
    if (column < 13 || column > 19) return match;
    let styleId;
    if (row >= 56 && row <= 57) styleId = styles.header;
    else if (row >= 58 && row <= 77) styleId = column <= 16 ? styles.month : styles.amount;
    else return match;
    return match.replace(/ s="\d+"/, '').replace(`r="${col}${rowText}"`, `r="${col}${rowText}" s="${styleId}"`);
  });
}

function addLogoToDrawing(xml) {
  if (xml.includes('r:embed="rId7"')) return xml;
  const anchor = '<xdr:twoCellAnchor editAs="oneCell">'
    + '<xdr:from><xdr:col>9</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>'
    + '<xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>'
    + '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="12" name="FinSightAI Logo" title="FinSightAI"/>'
    + '<xdr:cNvPicPr preferRelativeResize="0"/></xdr:nvPicPr><xdr:blipFill>'
    + '<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId7" cstate="print"/>'
    + '<a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr>'
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></xdr:spPr></xdr:pic>'
    + '<xdr:clientData fLocksWithSheet="0"/></xdr:twoCellAnchor>';
  return xml.replace('</xdr:wsDr>', `${anchor}</xdr:wsDr>`);
}

function addLogoDrawingRelationship(xml) {
  if (xml.includes('Id="rId7"')) return xml;
  const relationship = '<Relationship Id="rId7" '
    + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
    + 'Target="../media/logo.png"/>';
  return xml.replace('</Relationships>', `${relationship}</Relationships>`);
}

function updateFinSightHyperlink(xml) {
  const relationship = /(<Relationship\b[^>]*Id="rId2"[^>]*Type="[^"]*\/hyperlink"[^>]*Target=")[^"]*("[^>]*\/>)/;
  if (!relationship.test(xml)) {
    throw new Error('sheet1.xml.rels: no se encontro el hipervinculo de FinSightAI');
  }
  return xml.replace(relationship, (_match, before, after) => `${before}${FINSIGHT_URL}${after}`);
}

// calcChain.xml es solo una ayuda de rendimiento (orden sugerido de recálculo). Como los valores
// inyectados en runtime desactualizan la cadena original, Excel 2016 la detecta inconsistente y
// pide "reparar" el archivo al abrir. Se elimina del paquete entero: Excel la reconstruye sola
// (más aún con fullCalcOnLoad="1" ya activado) y el aviso de reparación desaparece.
async function removeCalcChain(zip) {
  zip.remove('xl/calcChain.xml');

  const relsPath = 'xl/_rels/workbook.xml.rels';
  const rels = await zip.file(relsPath).async('string');
  zip.file(relsPath, rels.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/, ''));

  const typesPath = '[Content_Types].xml';
  const types = await zip.file(typesPath).async('string');
  zip.file(typesPath, types.replace(/<Override PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ''));
}

// xl/tables/table1.xml guarda el nombre de cada columna como atributo propio, independiente
// del texto real de la celda de encabezado (que vive en sharedStrings). Excel valida que ambos
// coincidan exactamente; si no, considera la tabla corrupta y la "repara" al abrir. Como los
// headers de la fila 4 se tradujeron, acá se actualiza table1.xml con el mismo texto.
const TABLE_COLUMN_RENAMES = [
  ['name="Month"', 'name="Mes"'],
  ['name="Employee Count at the Beginning of the Month"', 'name="Ingreso Acumulado (mes anterior)"'],
  ['name="Employees Added"', 'name="Ingresos del Mes"'],
  ['name="Employee Count at the End of the Month"', 'name="Ingreso Acumulado (fin de mes)"'],
  ['name="Mean Employee Count"', 'name="Ingreso Acumulado Promedio"'],
  [
    'name="Attrition Rate %_x000a_(No. of Employees Left / Ave. Total Emp.)*100"',
    'name="% Gasto / Ingreso Acum._x000a_(Gasto del Mes / Ingreso Acum. Promedio)*100"',
  ],
  ['name="Departure Cost"', 'name="Balance Anual"'],
  ['name="Sales"', 'name="Alimentación"'],
  ['name="IT"', 'name="Vivienda"'],
  ['name="Human Resource"', 'name="Transporte"'],
  ['name="Operations"', 'name="Servicios"'],
  ['name="Finance"', 'name="Salud"'],
  ['name="Marketing"', 'name="Otros"'],
  ['name="Total per Month"', 'name="Total Gastos del Mes"'],
];

function renameTableColumns(xml) {
  let out = xml;
  for (const [from, to] of TABLE_COLUMN_RENAMES) {
    if (!out.includes(from)) throw new Error(`table1.xml: no se encontró ${from}`);
    out = out.replace(from, to);
  }
  return out;
}

// El table1.xml del template original de attrition nunca tuvo <autoFilter>, pese a declarar una
// fila de encabezado (headerRowCount por defecto = 1). Excel exige ese elemento para una Tabla
// con encabezado y, al no encontrarlo, la marca como corrupta y la "repara" (visible en el log
// de recuperación como "Tabla de /xl/tables/table1.xml parte"). Se agrega justo después del tag
// <table ...> y antes de <tableColumns>, como exige el orden del esquema CT_Table.
function addAutoFilter(xml) {
  const refMatch = xml.match(/<table[^>]*\sref="([^"]+)"/);
  if (!refMatch) throw new Error('table1.xml: no se encontró el atributo ref de <table>');
  const ref = refMatch[1];
  if (xml.includes('<autoFilter')) return xml;
  return xml.replace('<tableColumns', `<autoFilter ref="${ref}"/><tableColumns`);
}

// Excel exige que los nombres internos de la tabla coincidan exactamente con los textos
// visibles de la fila de encabezado. Los saltos de linea se guardan como `_x000a_` en los
// atributos de tableColumn, por lo que una diferencia tan pequena como un salto duplicado
// hace que Excel repare (y quite) table1.xml al abrir el libro.
function validateTableColumnNames(xml) {
  const expectedNames = [36, 37, 6, 38, 39, 40, 10, 41, 42, 43, 44, 45, 46, 47]
    .map((index) => STRING_MAP[index].join('').replaceAll('\n', '_x000a_'));
  const actualNames = [...xml.matchAll(/<tableColumn\b[^>]*\bname="([^"]*)"/g)]
    .map((match) => match[1]);

  if (actualNames.length !== expectedNames.length) {
    throw new Error(`table1.xml: se esperaban ${expectedNames.length} columnas y hay ${actualNames.length}`);
  }

  expectedNames.forEach((expected, index) => {
    if (actualNames[index] !== expected) {
      throw new Error(
        `table1.xml: columna ${index + 1} no coincide con su encabezado: "${actualNames[index]}" != "${expected}"`,
      );
    }
  });
}

const SHEET_RENAMES = {
  'Attrition Analysis Dashboard': 'Dashboard',
  'Attrition Details': 'Detalle',
  Demographics: 'Categorías',
};

// El nombre de una hoja también aparece dentro de fórmulas y rangos de gráficos. Cambiar
// solamente workbook.xml deja referencias rotas; por eso se actualizan todos los XML del libro.
async function renameSheetsAndReferences(zip) {
  const xmlPaths = Object.keys(zip.files).filter(
    (filePath) => filePath.startsWith('xl/') && filePath.endsWith('.xml') && !zip.files[filePath].dir,
  );

  for (const filePath of xmlPaths) {
    const original = await zip.file(filePath).async('string');
    let renamed = original;
    for (const [oldName, newName] of Object.entries(SHEET_RENAMES)) {
      renamed = renamed.replaceAll(oldName, newName);
    }
    if (renamed !== original) zip.file(filePath, renamed);
  }

  const workbook = await zip.file('xl/workbook.xml').async('string');
  const actualNames = [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)]
    .map((match) => match[1]);
  const expectedNames = Object.values(SHEET_RENAMES);
  if (actualNames.length !== expectedNames.length || actualNames.some((name, i) => name !== expectedNames[i])) {
    throw new Error(`workbook.xml: nombres de hojas inesperados: ${actualNames.join(', ')}`);
  }

  for (const oldName of Object.keys(SHEET_RENAMES)) {
    for (const filePath of xmlPaths) {
      const xml = await zip.file(filePath).async('string');
      if (xml.includes(oldName)) throw new Error(`${filePath}: quedó una referencia a ${oldName}`);
    }
  }
}

// Aplica los acentos del frontend a todo el libro, no solo a los graficos. La plantilla
// original tambien guarda el naranja y el teal en estilos de celda y formato condicional.
async function recolorWorkbookAccents(zip) {
  const xmlPaths = Object.keys(zip.files).filter(
    (filePath) => filePath.startsWith('xl/') && filePath.endsWith('.xml') && !zip.files[filePath].dir,
  );

  for (const filePath of xmlPaths) {
    const original = await zip.file(filePath).async('string');
    let recolored = original;
    for (const [from, to] of Object.entries(COLOR_MAP)) {
      recolored = recolored.replaceAll(from, to);
    }
    if (recolored !== original) zip.file(filePath, recolored);
  }

  for (const oldColor of Object.keys(COLOR_MAP)) {
    for (const filePath of xmlPaths) {
      const xml = await zip.file(filePath).async('string');
      if (xml.includes(oldColor)) throw new Error(`${filePath}: quedo el color antiguo ${oldColor}`);
    }
  }
}

// jszip crea entradas de carpeta sintéticas ("xl/", "xl/worksheets/", ...) como efecto
// secundario de sobrescribir archivos anidados con zip.file(path, contenido). Un .xlsx real
// generado por Excel nunca tiene esas entradas, y Excel 2016 lo interpreta como paquete dañado
// (reparaba la Tabla, sin relación real con el contenido de la tabla). Se eliminan antes de
// empaquetar.
function removeSyntheticFolderEntries(zip) {
  // OJO: zip.remove(path) en una carpeta borra en cascada todo lo que contiene.
  // Hay que borrar solo la entrada del diccionario interno, no usar la API remove().
  Object.keys(zip.files)
    .filter((path) => zip.files[path].dir)
    .forEach((path) => {
      delete zip.files[path];
    });
}

// Los nombres internos de las pestañas se traducen junto con todas sus referencias mediante
// renameSheetsAndReferences(), después de terminar las demás transformaciones del libro.

async function main() {
  const buf = readFileSync(SOURCE);
  const zip = await JSZip.loadAsync(buf);
  zip.file('xl/media/logo.png', readFileSync(LOGO_FILE));

  const sharedStrings = await zip.file('xl/sharedStrings.xml').async('string');
  zip.file('xl/sharedStrings.xml', replaceSharedStrings(sharedStrings));

  const styles = await zip.file('xl/styles.xml').async('string');
  const currencyStyles = addCurrencyFormats(resizeDashboardKpiFonts(styles));
  zip.file('xl/styles.xml', currencyStyles.xml);

  const workbook = await zip.file('xl/workbook.xml').async('string');
  zip.file('xl/workbook.xml', removeRepairFlag(forceRecalcOnLoad(workbook)));

  const sheet1 = await zip.file('xl/worksheets/sheet1.xml').async('string');
  zip.file(
    'xl/worksheets/sheet1.xml',
    applyDashboardExpenseTableStyles(
      resizeDashboardFooterAndMergeLogoArea(sheet1),
      currencyStyles.dashboardTableStyles,
    ),
  );

  const sheet2 = await zip.file('xl/worksheets/sheet2.xml').async('string');
  const sheet3 = await zip.file('xl/worksheets/sheet3.xml').async('string');
  const resizedSheets = setWorksheetColumnWidths(sheet2, sheet3);
  zip.file('xl/worksheets/sheet2.xml', resizedSheets.detail);
  zip.file(
    'xl/worksheets/sheet3.xml',
    applyCategoryCurrencyStyles(
      fillDemographicsWithFinanceData(resizedSheets.categories),
      currencyStyles.categoryStyleMap,
      currencyStyles.categoryPercentageStyle,
    ),
  );

  const drawing = await zip.file('xl/drawings/drawing1.xml').async('string');
  zip.file('xl/drawings/drawing1.xml', addLogoToDrawing(drawing));
  const drawingRelsPath = 'xl/drawings/_rels/drawing1.xml.rels';
  const drawingRels = await zip.file(drawingRelsPath).async('string');
  zip.file(drawingRelsPath, addLogoDrawingRelationship(drawingRels));

  const dashboardRelsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  const dashboardRels = await zip.file(dashboardRelsPath).async('string');
  zip.file(dashboardRelsPath, updateFinSightHyperlink(dashboardRels));

  const table1 = await zip.file('xl/tables/table1.xml').async('string');
  const normalizedTable1 = addAutoFilter(renameTableColumns(table1));
  validateTableColumnNames(normalizedTable1);
  zip.file('xl/tables/table1.xml', normalizedTable1);

  for (const chartFile of ['chart1.xml', 'chart2.xml', 'chart3.xml', 'chart4.xml']) {
    const p = `xl/charts/${chartFile}`;
    let xml = await zip.file(p).async('string');
    xml = recolorChart(xml);
    if (chartFile === 'chart4.xml') {
      xml = xml.replaceAll('formatCode="General"', () => `formatCode="${CURRENCY_FORMAT}"`);
    }
    zip.file(p, xml);
  }

  await removeCalcChain(zip);
  await renameSheetsAndReferences(zip);
  await recolorWorkbookAccents(zip);
  removeSyntheticFolderEntries(zip);

  mkdirSync(OUT_DIR, { recursive: true });
  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  writeFileSync(OUT_FILE, out);
  console.log('Escrito', OUT_FILE, `(${(out.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
