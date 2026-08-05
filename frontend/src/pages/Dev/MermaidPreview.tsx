import { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import ExcelJS from 'exceljs';
import Swal from 'sweetalert2';
import Button from '../../components/ui/button/Button';

/**
 * Página sin enlace en el menú: solo accesible escribiendo /dev/mermaid-preview.
 * Sirve para pegar el código Mermaid que genera la skill "use-case-generator"
 * (bloques ```mermaid dentro de los .md de docs/) y revisar la vista previa
 * antes de incrustarlo, o exportarlo como imagen.
 */

const PLACEHOLDER = `sequenceDiagram
    title Ejemplo
    autonumber

    actor Usuario as Usuario
    boundary V as v_ejemplo
    control C as c_ejemplo
    database DB as ejemplo

    Usuario->>V: Acción
    V->>C: Petición
    C->>DB: Consulta
    DB-->>C: Resultado
    C-->>V: Respuesta
    V-->>Usuario: Confirmación`;

type Bloque = { titulo: string; codigo: string };

/** Extrae bloques ```mermaid ...``` de un .md pegado completo (como los docs/UC-*.md). */
function extraerBloquesMermaid(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  const regex = /```mermaid\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let i = 1;
  while ((match = regex.exec(texto)) !== null) {
    const codigo = match[1].trim();
    const tituloEnCodigo = codigo.match(/title\s+(.+)/)?.[1]?.trim();
    bloques.push({ titulo: tituloEnCodigo || `Diagrama ${i}`, codigo });
    i += 1;
  }
  return bloques;
}

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });

/**
 * La skill "use-case-generator" declara actores con estereotipos BCE de PlantUML
 * (`boundary`, `control`, `entity`, `database`), pero el parser real de Mermaid.js
 * solo reconoce `actor` y `participant` como tipos de declaración válidos. Sin esta
 * normalización, todo bloque generado por la skill falla con "Syntax error in text".
 */
function normalizarParticipantesBce(codigo: string): string {
  return codigo.replace(
    /^(\s*)(boundary|control|entity|database)(\s+\S+\s+as\s+.+)$/gim,
    '$1participant$3',
  );
}

type BloqueDoc =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string; bullet: boolean }
  | { type: 'divider' }
  | { type: 'mermaid'; code: string; titulo?: string }
  | { type: 'table'; headers: string[]; rows: string[][] };

/**
 * Parser de línea a línea del .md completo de casos de uso: separa encabezados,
 * párrafos/listas, tablas y bloques ```mermaid``` en orden, para poder recomponerlos
 * como documento PDF o HTML con texto e imágenes intercalados. Conserva el markdown
 * inline (**negrita**, `code`, [texto](link)) sin resolver — cada renderer (PDF/HTML)
 * decide cómo mostrarlo.
 */
function parseMarkdownDocument(texto: string): BloqueDoc[] {
  const lineas = texto.split(/\r?\n/);
  const bloques: BloqueDoc[] = [];
  let i = 0;
  while (i < lineas.length) {
    const trimmed = lineas[i].trim();

    if (trimmed.startsWith('```mermaid')) {
      const codigo: string[] = [];
      i += 1;
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) {
        codigo.push(lineas[i]);
        i += 1;
      }
      i += 1; // saltar el ``` de cierre
      const codigoStr = codigo.join('\n').trim();
      const tituloMatch = codigoStr.match(/title\s+(.+)/);
      bloques.push({ type: 'mermaid', code: codigoStr, titulo: tituloMatch?.[1]?.trim() });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      bloques.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].replace(/<a id="[^"]*">\s*<\/a>\s*/, ''),
      });
      i += 1;
      continue;
    }

    if (trimmed === '---') {
      bloques.push({ type: 'divider' });
      i += 1;
      continue;
    }

    if (trimmed === '' || trimmed.startsWith('<')) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('|')) {
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) {
        const fila = lineas[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        // La fila separadora de Markdown ("---|---|...") no es dato, se descarta.
        if (!fila.every((c) => /^:?-+:?$/.test(c))) filas.push(fila);
        i += 1;
      }
      const [headers, ...rows] = filas;
      if (headers) bloques.push({ type: 'table', headers, rows });
      continue;
    }

    const bullet = /^[-*]\s+/.test(trimmed);
    const texto2 = bullet ? trimmed.replace(/^[-*]\s+/, '') : trimmed;
    bloques.push({ type: 'paragraph', text: texto2, bullet });
    i += 1;
  }
  return bloques;
}

/** Quita `**negrita**`, `` `code` `` y `[texto](link)` dejando solo el texto plano (para el PDF). */
function mdInlineToPlainText(texto: string): string {
  return texto
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function escapeHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convierte `**negrita**`, `` `code` `` y `[texto](link)` a HTML real, escapando el resto. */
function mdInlineToHtml(texto: string): string {
  let t = escapeHtml(texto);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`);
  return t;
}

/** Categoría/color de cada caso de uso — no se puede derivar del .md, es clasificación de dominio. */
/**
 * Colores tomados literalmente de los design tokens de la app (`src/index.css`,
 * bloque `@theme`) — no son una paleta inventada para este documento:
 * brand-500, success-600, orange-500, theme-purple-500, blue-light-600 y error-600.
 */
const CATEGORIA_POR_CU: Record<string, { tipo: string; color: string }> = {
  CU01: { tipo: 'Autenticación y Cuenta', color: '#465fff' }, // --color-brand-500
  CU02: { tipo: 'Autenticación y Cuenta', color: '#465fff' },
  CU03: { tipo: 'Autenticación y Cuenta', color: '#465fff' },
  CU04: { tipo: 'Autenticación y Cuenta', color: '#465fff' },
  CU05: { tipo: 'Autenticación y Cuenta', color: '#465fff' },
  CU06: { tipo: 'Autenticación y Cuenta', color: '#465fff' },
  CU07: { tipo: 'Gestión Financiera', color: '#039855' }, // --color-success-600
  CU08: { tipo: 'Gestión Financiera', color: '#039855' },
  CU09: { tipo: 'Gestión Financiera', color: '#039855' },
  CU10: { tipo: 'Gestión Financiera', color: '#039855' },
  CU11: { tipo: 'Metas de Ahorro', color: '#fb6514' }, // --color-orange-500
  CU12: { tipo: 'Metas de Ahorro', color: '#fb6514' },
  CU13: { tipo: 'Metas de Ahorro', color: '#fb6514' },
  CU14: { tipo: 'Asistente de IA', color: '#7a5af8' }, // --color-theme-purple-500
  CU15: { tipo: 'Asistente de IA', color: '#7a5af8' },
  CU16: { tipo: 'Reportes y Exportación', color: '#0086c9' }, // --color-blue-light-600
  CU17: { tipo: 'Autenticación y Cuenta', color: '#465fff' },
  CU18: { tipo: 'Administración', color: '#d92d20' }, // --color-error-600
};
const CATEGORIA_DEFAULT = { tipo: 'General', color: '#667085' };

type GrupoDoc = { kind: 'preamble' | 'closing' } | { kind: 'cu'; id: string; titulo: string };
type Grupo = { meta: GrupoDoc; bloques: BloqueDoc[] };

/**
 * Agrupa la secuencia plana de bloques en secciones: preámbulo (intro/actores),
 * una por cada "# CUxx - Nombre" y un cierre (tabla de trazabilidad final).
 * También descarta el índice manual del .md (armamos uno propio, con anchors reales).
 */
function agruparParaHtml(bloques: BloqueDoc[]): Grupo[] {
  const grupos: Grupo[] = [{ meta: { kind: 'preamble' }, bloques: [] }];
  let saltandoIndice = false;
  let primeraHeadingVista = false;

  for (const b of bloques) {
    if (b.type === 'heading') {
      if (!primeraHeadingVista && b.level === 1 && !/^CU\d+/.test(b.text)) {
        primeraHeadingVista = true;
        continue; // título general del .md — ya mostramos nuestra propia portada
      }
      primeraHeadingVista = true;

      if (b.level === 2 && b.text.trim() === 'Índice') {
        saltandoIndice = true;
        continue;
      }
      saltandoIndice = false;

      const match = b.text.match(/^(CU\d+)\s*-\s*(.+)$/);
      if (b.level === 1 && match) {
        grupos.push({ meta: { kind: 'cu', id: match[1], titulo: match[2] }, bloques: [] });
        continue;
      }
      if (b.level <= 2 && grupos[grupos.length - 1].meta.kind === 'cu') {
        grupos.push({ meta: { kind: 'closing' }, bloques: [] });
      }
    }

    if (saltandoIndice) continue;
    grupos[grupos.length - 1].bloques.push(b);
  }
  return grupos;
}

/** Extrae las 3 líneas de metadatos (Actores/Precondiciones/Postcondiciones) al inicio de un CU. */
function extraerMeta(bloques: BloqueDoc[]): { meta: { label: string; valor: string }[]; resto: BloqueDoc[] } {
  const meta: { label: string; valor: string }[] = [];
  let i = 0;
  while (i < bloques.length) {
    const b = bloques[i];
    if (b.type === 'paragraph' && b.bullet) {
      const m = b.text.match(/^\*\*([^*]+):\*\*\s*(.+)$/);
      if (m) {
        meta.push({ label: m[1], valor: m[2] });
        i += 1;
        continue;
      }
    }
    break;
  }
  return { meta, resto: bloques.slice(i) };
}

type FilaExcel = {
  id: string;
  nombre: string;
  tipo: string;
  actores: string;
  boundary: string;
  control: string;
  entity: string;
  precondiciones: string;
  postcondiciones: string;
  flujoPrincipal: string;
  alternativas: string;
  endpoints: string;
};

/** Extrae Boundary/Control/Entity de las declaraciones `boundary/control/database X as Y` del mermaid crudo (sin normalizar). */
function extraerBoundaryControlEntity(codigoMermaid: string): { boundary: string; control: string; entity: string } {
  const boundary = new Set<string>();
  const control = new Set<string>();
  const entity = new Set<string>();
  const regex = /^\s*(boundary|control|entity|database)\s+\S+\s+as\s+(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(codigoMermaid)) !== null) {
    const tipo = m[1].toLowerCase();
    const etiqueta = m[2].trim();
    if (tipo === 'boundary') boundary.add(etiqueta);
    else if (tipo === 'control') control.add(etiqueta);
    else entity.add(etiqueta);
  }
  return {
    boundary: [...boundary].join(', ') || '—',
    control: [...control].join(', ') || '—',
    entity: [...entity].join(', ') || '—',
  };
}

/** Extrae mensajes con verbo HTTP (endpoints) de las flechas del diagrama de secuencia. */
function extraerEndpoints(codigosMermaid: string[]): string {
  const encontrados = new Set<string>();
  const regexMensaje = /^\s*[A-Za-z0-9_]+\s*-{1,2}>{1,2}\s*[A-Za-z0-9_]+\s*:\s*(.+)$/gm;
  for (const codigo of codigosMermaid) {
    let m: RegExpExecArray | null;
    while ((m = regexMensaje.exec(codigo)) !== null) {
      const mensaje = m[1].trim();
      if (/\b(GET|POST|PUT|PATCH|DELETE)\b/.test(mensaje)) encontrados.add(mensaje);
    }
  }
  return [...encontrados].join('; ') || '—';
}

/**
 * Recorre el .md y arma una fila por cada "# CUxx - Nombre", reutilizando el mismo
 * agrupador que usa el documento HTML (`agruparParaHtml`/`extraerMeta`) para no
 * duplicar la lógica de qué texto pertenece a qué caso de uso.
 */
function extraerFilasParaExcel(texto: string): FilaExcel[] {
  const bloques = parseMarkdownDocument(texto);
  const grupos = agruparParaHtml(bloques);

  const filas: FilaExcel[] = [];
  for (const grupo of grupos) {
    if (grupo.meta.kind !== 'cu') continue;
    const { id, titulo } = grupo.meta;
    const cat = CATEGORIA_POR_CU[id] || CATEGORIA_DEFAULT;
    const { meta, resto } = extraerMeta(grupo.bloques);
    const valorMeta = (label: string) => meta.find((m) => m.label === label)?.valor ?? '—';

    let contexto: 'flujo' | 'alt' | null = null;
    const flujoItems: string[] = [];
    const altItems: string[] = [];
    const codigosMermaid: string[] = [];

    for (const b of resto) {
      if (b.type === 'heading') {
        if (/Flujo Principal/i.test(b.text)) contexto = 'flujo';
        else if (/Alternativos|Excepciones/i.test(b.text)) contexto = 'alt';
        else contexto = null;
        continue;
      }
      if (b.type === 'mermaid') {
        codigosMermaid.push(b.code);
        continue;
      }
      if (b.type !== 'paragraph') continue;
      const numMatch = b.text.match(/^\d+\.\s+(.+)$/);
      if (contexto === 'flujo') flujoItems.push(mdInlineToPlainText(numMatch ? numMatch[1] : b.text));
      else if (contexto === 'alt' && b.bullet) altItems.push(mdInlineToPlainText(b.text));
    }

    const bce = extraerBoundaryControlEntity(codigosMermaid[0] || '');

    filas.push({
      id,
      nombre: titulo,
      tipo: cat.tipo,
      actores: valorMeta('Actores Principales'),
      boundary: bce.boundary,
      control: bce.control,
      entity: bce.entity,
      precondiciones: valorMeta('Precondiciones'),
      postcondiciones: valorMeta('Postcondiciones'),
      flujoPrincipal: flujoItems.map((t, idx) => `${idx + 1}) ${t}`).join('  '),
      alternativas: altItems.join('  '),
      endpoints: extraerEndpoints(codigosMermaid),
    });
  }
  return filas;
}

type ItemHtml =
  | { kind: 'heading'; level: number; html: string }
  | { kind: 'list'; ordered: boolean; variant: 'alt' | 'plain'; items: string[] }
  | { kind: 'p'; html: string }
  | { kind: 'mermaid'; svg: string; titulo: string }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'divider' };

/** Agrupa párrafos consecutivos en listas (numeradas para "Flujo Principal", con acento para "Alternativos"). */
function agruparListasHtml(bloques: BloqueDoc[], svgPorBloque: Map<BloqueDoc, string>): ItemHtml[] {
  const out: ItemHtml[] = [];
  let contexto: 'flujo' | 'alt' | null = null;
  let listaActual: { ordered: boolean; variant: 'alt' | 'plain'; items: string[] } | null = null;

  const cerrarLista = () => {
    if (listaActual) {
      out.push({ kind: 'list', ordered: listaActual.ordered, variant: listaActual.variant, items: listaActual.items });
      listaActual = null;
    }
  };

  for (const b of bloques) {
    if (b.type === 'heading') {
      cerrarLista();
      if (/Flujo Principal/i.test(b.text)) contexto = 'flujo';
      else if (/Alternativos|Excepciones/i.test(b.text)) contexto = 'alt';
      else contexto = null;
      out.push({ kind: 'heading', level: b.level, html: mdInlineToHtml(b.text) });
      continue;
    }
    if (b.type === 'divider') {
      cerrarLista();
      out.push({ kind: 'divider' });
      continue;
    }
    if (b.type === 'mermaid') {
      cerrarLista();
      out.push({ kind: 'mermaid', svg: svgPorBloque.get(b) || '', titulo: b.titulo || 'Diagrama' });
      continue;
    }
    if (b.type === 'table') {
      cerrarLista();
      out.push({ kind: 'table', headers: b.headers, rows: b.rows });
      continue;
    }

    const numMatch = b.text.match(/^(\d+)\.\s+(.+)$/);
    if (contexto === 'flujo' && numMatch) {
      if (!listaActual || !listaActual.ordered) {
        cerrarLista();
        listaActual = { ordered: true, variant: 'plain', items: [] };
      }
      listaActual.items.push(mdInlineToHtml(numMatch[2]));
      continue;
    }
    if (b.bullet) {
      const variant = contexto === 'alt' ? 'alt' : 'plain';
      if (!listaActual || listaActual.ordered || listaActual.variant !== variant) {
        cerrarLista();
        listaActual = { ordered: false, variant, items: [] };
      }
      listaActual.items.push(mdInlineToHtml(b.text));
      continue;
    }
    cerrarLista();
    out.push({ kind: 'p', html: mdInlineToHtml(b.text) });
  }
  cerrarLista();
  return out;
}

function renderItemsHtml(items: ItemHtml[]): string {
  const sizeClass: Record<number, string> = { 1: 'h3', 2: 'h3', 3: 'h4', 4: 'h4' };
  return items
    .map((item) => {
      if (item.kind === 'heading') {
        const icono = /Flujo Principal/i.test(item.html) ? '📋 ' : /Alternativos|Excepciones/i.test(item.html) ? '⚠️ ' : '';
        return `<${sizeClass[item.level] || 'h4'} class="sub-heading">${icono}${item.html}</${sizeClass[item.level] || 'h4'}>`;
      }
      if (item.kind === 'p') return `<p class="text-block">${item.html}</p>`;
      if (item.kind === 'divider') return '<hr class="divider" />';
      if (item.kind === 'list') {
        const tag = item.ordered ? 'ol' : 'ul';
        const cls = item.ordered ? 'steps' : item.variant === 'alt' ? 'alt-list' : 'bullets';
        return `<${tag} class="${cls}">${item.items.map((it) => `<li>${it}</li>`).join('')}</${tag}>`;
      }
      if (item.kind === 'table') {
        const head = `<tr>${item.headers.map((h) => `<th>${mdInlineToHtml(h)}</th>`).join('')}</tr>`;
        const body = item.rows
          .map((row) => `<tr>${row.map((c) => `<td>${mdInlineToHtml(c)}</td>`).join('')}</tr>`)
          .join('');
        return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
      }
      // mermaid
      const esExito = /Éxito/i.test(item.titulo);
      const claseAcento = esExito ? 'diagram-success' : 'diagram-alt';
      const icono = esExito ? '✅' : '⚠️';
      return `
        <div class="diagram-card ${claseAcento}">
          <div class="diagram-card-header">${icono} ${escapeHtml(item.titulo)}</div>
          <div class="diagram-card-body">${item.svg}</div>
        </div>`;
    })
    .join('\n');
}

function renderGrupoHtml(grupo: Grupo, svgPorBloque: Map<BloqueDoc, string>): string {
  if (grupo.meta.kind === 'cu') {
    const { id, titulo } = grupo.meta;
    const cat = CATEGORIA_POR_CU[id] || CATEGORIA_DEFAULT;
    const { meta, resto } = extraerMeta(grupo.bloques);
    const items = agruparListasHtml(resto, svgPorBloque);
    return `
      <section class="cu-card" id="${id.toLowerCase()}" style="--accent:${cat.color}">
        <header class="cu-card-header">
          <span class="cu-badge">${id}</span>
          <div>
            <span class="cu-tipo-chip">${escapeHtml(cat.tipo)}</span>
            <h2>${escapeHtml(titulo)}</h2>
          </div>
        </header>
        ${
          meta.length
            ? `<div class="cu-meta-grid">${meta
                .map((m) => `<div class="meta-item"><span class="meta-label">${escapeHtml(m.label)}</span><span class="meta-value">${mdInlineToHtml(m.valor)}</span></div>`)
                .join('')}</div>`
            : ''
        }
        <div class="cu-body">${renderItemsHtml(items)}</div>
      </section>`;
  }

  const items = agruparListasHtml(grupo.bloques, svgPorBloque);
  if (!items.length) return '';
  return `<section class="plain-card">${renderItemsHtml(items)}</section>`;
}

const ICONO_GITHUB =
  'M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55 0-.27-.01-1.13-.02-2.04-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .3.2.66.79.55A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z';

/**
 * Descarga una imagen del propio origen (misma app) y la devuelve como data URL, para
 * que el documento generado sea autocontenido: sigue viéndose bien aunque se lo
 * descargue y se abra más tarde, sin el servidor de desarrollo corriendo. Si falla
 * (offline, ruta inexistente), cae de vuelta a la URL original tal cual.
 */
async function cargarImagenComoDataUrl(url: string): Promise<string> {
  try {
    const respuesta = await fetch(url);
    const blob = await respuesta.blob();
    return await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
      lector.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/**
 * Arma el <head><style> del documento HTML. Los tokens (colores, radios, sombras)
 * están tomados literalmente de `src/index.css` (bloque `@theme` de Tailwind v4) para
 * que el documento se vea como una pieza más del propio FinSightIA, no como un
 * diseño aparte — mismo azul de marca, misma tipografía Outfit, misma escala de grises.
 */
function construirEstilosHtml(): string {
  return `
  @import url("https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap");

  :root{
    /* --- tokens copiados de src/index.css (@theme) --- */
    --bg:#f9fafb;            /* --color-gray-50 */
    --card:#ffffff;
    --ink:#101828;           /* --color-gray-900 / --color-black */
    --ink-soft:#344054;      /* --color-gray-700 */
    --muted:#667085;         /* --color-gray-500 */
    --border:#e4e7ec;        /* --color-gray-200 */
    --border-soft:#f2f4f7;   /* --color-gray-100 */

    --brand:#465fff;         /* --color-brand-500 */
    --brand-50:#ecf3ff;      /* --color-brand-50 */
    --brand-600:#3641f5;     /* --color-brand-600 */
    --brand-700:#2a31d8;     /* --color-brand-700 */

    --success:#039855;       /* --color-success-600 */
    --success-50:#ecfdf3;    /* --color-success-50 */
    --warning:#b54708;       /* --color-warning-700 */
    --warning-50:#fffaeb;    /* --color-warning-50 */
    --warning-border:#fedf89;/* --color-warning-200 */
    --pink:#ee46bc;          /* --color-theme-pink-500 */

    --shadow-xs:0px 1px 2px 0px rgba(16,24,40,.05);   /* --shadow-theme-xs */
    --shadow-sm:0px 1px 3px 0px rgba(16,24,40,.1), 0px 1px 2px 0px rgba(16,24,40,.06); /* --shadow-theme-sm */
    --shadow-md:0px 4px 8px -2px rgba(16,24,40,.1), 0px 2px 4px -2px rgba(16,24,40,.06); /* --shadow-theme-md */
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Outfit',system-ui,-apple-system,sans-serif;line-height:1.55}
  .page{max-width:1100px;margin:0 auto;padding:28px 20px 64px}
  code{background:var(--border-soft);color:var(--pink);padding:1px 6px;border-radius:5px;font-size:0.85em;font-family:'Cascadia Code',Consolas,monospace}
  a{color:var(--brand)}

  .toolbar{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--border);padding:10px 20px;display:flex;align-items:center;gap:10px;justify-content:space-between;box-shadow:var(--shadow-xs)}
  .toolbar-logo{height:30px;width:auto;display:block}
  .toolbar-actions{display:flex;gap:10px}
  .toolbar button{border:1px solid var(--border);background:#fff;border-radius:8px;padding:9px 16px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;color:var(--ink-soft);transition:background .15s}
  .toolbar button.primary{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:var(--shadow-xs)}
  .toolbar button.primary:hover{background:var(--brand-600)}
  .toolbar button:not(.primary):hover{background:var(--border-soft)}

  .profile-header{background:var(--card);border:1px solid var(--border);border-radius:20px;margin-top:24px;overflow:hidden;box-shadow:var(--shadow-sm)}
  .profile-banner{height:88px;background:linear-gradient(135deg,var(--brand),var(--brand-700))}
  .profile-body{display:flex;gap:24px;align-items:flex-end;padding:0 32px 28px;margin-top:-46px;flex-wrap:wrap}
  .profile-avatar{width:104px;height:104px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:var(--shadow-md);background:#fff}
  .profile-info{padding-top:54px;flex:1;min-width:240px}
  .profile-info h1{margin:0;font-size:26px;font-weight:800;letter-spacing:-0.02em}
  .profile-info .role{color:var(--muted);font-weight:500;margin:2px 0 14px}
  .profile-links{display:flex;flex-wrap:wrap;gap:10px}
  .profile-links a{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:8px;color:#fff;font-size:13px;font-weight:600;text-decoration:none;box-shadow:var(--shadow-xs)}
  .profile-links a.gh{background:#181717}
  .profile-links a.li{background:#0a66c2}
  .profile-links a.pf{background:var(--success)}
  .profile-stats{display:flex;gap:10px;padding:16px 32px 22px;flex-wrap:wrap;border-top:1px solid var(--border)}
  .stat-chip{background:var(--brand-50);color:var(--brand);font-weight:700;font-size:12.5px;padding:6px 14px;border-radius:999px}

  .doc-title{text-align:center;margin:36px 0 6px}
  .doc-title h1{font-size:30px;font-weight:800;letter-spacing:-0.02em;margin:0}
  .doc-title p{color:var(--muted);margin:6px 0 0}

  .index-nav{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:24px 0 36px}
  .index-nav a{font-size:12.5px;font-weight:700;padding:7px 13px;border-radius:999px;text-decoration:none;border:1px solid transparent}

  .plain-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px 28px;margin-bottom:22px}
  .plain-card h2, .plain-card h3{margin-top:0}

  .cu-card{background:var(--card);border:1px solid var(--border);border-left:5px solid var(--accent);border-radius:16px;padding:24px 28px;margin-bottom:24px;box-shadow:var(--shadow-xs)}
  .cu-card-header{display:flex;align-items:center;gap:14px;margin-bottom:14px}
  .cu-badge{background:var(--accent);color:#fff;font-weight:800;font-size:12.5px;padding:6px 12px;border-radius:8px;letter-spacing:.02em;flex-shrink:0}
  .cu-tipo-chip{display:inline-block;background:color-mix(in srgb, var(--accent) 14%, white);color:var(--accent);font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:4px}
  .cu-card-header h2{margin:2px 0 0;font-size:19px;font-weight:800}

  .cu-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:18px}
  .meta-item{display:flex;flex-direction:column;gap:3px}
  .meta-label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
  .meta-value{font-size:13px;color:var(--ink)}

  .sub-heading{font-size:14.5px;font-weight:800;margin:20px 0 8px}
  .text-block{font-size:13.5px;color:var(--ink-soft);margin:0 0 10px}

  .steps{list-style:none;padding:0;margin:0 0 12px;display:flex;flex-direction:column;gap:10px;counter-reset:step}
  .steps>li{counter-increment:step;position:relative;padding-left:34px;font-size:13.5px;color:var(--ink-soft)}
  .steps>li::before{content:counter(step);position:absolute;left:0;top:-1px;width:24px;height:24px;border-radius:50%;background:var(--accent,var(--brand));color:#fff;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center}

  .alt-list{list-style:none;padding:0;margin:0 0 12px;display:flex;flex-direction:column;gap:8px}
  .alt-list>li{background:var(--warning-50);border:1px solid var(--warning-border);border-left:3px solid var(--warning);border-radius:9px;padding:9px 13px;font-size:13px;color:var(--warning)}

  .bullets{margin:0 0 12px;padding-left:20px;display:flex;flex-direction:column;gap:6px}
  .bullets>li{font-size:13.5px;color:var(--ink-soft)}

  .divider{border:none;border-top:1px solid var(--border);margin:18px 0}

  .diagram-card{border:1px solid var(--border);border-radius:14px;overflow:hidden;margin:16px 0;background:#fff}
  .diagram-card-header{padding:10px 16px;font-weight:800;font-size:12.5px;color:#fff}
  .diagram-success .diagram-card-header{background:var(--success)}
  .diagram-alt .diagram-card-header{background:var(--warning)}
  .diagram-card-body{padding:16px;overflow-x:auto;background:#fff;text-align:center}
  .diagram-card-body svg{max-width:100%;height:auto}

  .table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;margin:12px 0}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  thead th{background:var(--ink);color:#fff;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.03em;position:sticky;top:0}
  tbody td{padding:9px 12px;border-top:1px solid var(--border);vertical-align:top}
  tbody tr:nth-child(even){background:var(--bg)}

  .doc-footer{text-align:center;color:var(--muted);font-size:12px;margin-top:40px}

  @media (max-width:640px){
    .cu-meta-grid{grid-template-columns:1fr}
    .profile-body{flex-direction:column;align-items:flex-start}
    .toolbar{flex-wrap:wrap;justify-content:center}
  }
  @media print{
    .no-print{display:none !important}
    body{background:#fff}
    .cu-card, .plain-card, .diagram-card{break-inside:avoid;box-shadow:none}
    @page{margin:14mm}
  }`;
}

/**
 * Renderiza TODOS los diagramas del .md (SVG vectorial, sin rasterizar — la calidad
 * es muy superior a la del PDF) y arma el documento HTML autocontenido: portada del
 * autor, índice, una tarjeta por caso de uso y el cierre con la tabla de trazabilidad.
 */
async function generarHtmlDocumento(texto: string): Promise<string> {
  const bloques = parseMarkdownDocument(texto);
  const grupos = agruparParaHtml(bloques);

  const svgPorBloque = new Map<BloqueDoc, string>();
  let contador = 0;
  for (const grupo of grupos) {
    for (const b of grupo.bloques) {
      if (b.type === 'mermaid') {
        const codigo = normalizarParticipantesBce(b.code);
        const id = `mermaid-html-${++contador}`;
        try {
          const { svg: svgRenderizado } = await mermaid.render(id, codigo);
          svgPorBloque.set(b, svgRenderizado);
        } catch (err) {
          svgPorBloque.set(
            b,
            `<p style="color:#b42318">No se pudo renderizar este diagrama: ${escapeHtml((err as Error).message)}</p>`,
          );
        }
      }
    }
  }

  const cuGrupos = grupos.filter((g): g is Grupo & { meta: { kind: 'cu'; id: string; titulo: string } } => g.meta.kind === 'cu');
  const totalDiagramas = svgPorBloque.size;
  const totalCategorias = new Set(cuGrupos.map((g) => (CATEGORIA_POR_CU[g.meta.id] || CATEGORIA_DEFAULT).tipo)).size;

  const indiceHtml = cuGrupos
    .map((g) => {
      const cat = CATEGORIA_POR_CU[g.meta.id] || CATEGORIA_DEFAULT;
      return `<a href="#${g.meta.id.toLowerCase()}" style="background:color-mix(in srgb, ${cat.color} 12%, white);color:${cat.color};border-color:color-mix(in srgb, ${cat.color} 30%, white)">${g.meta.id} · ${escapeHtml(g.meta.titulo)}</a>`;
    })
    .join('');

  const cuerpoHtml = grupos.map((g) => renderGrupoHtml(g, svgPorBloque)).join('\n');

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoDataUrl = await cargarImagenComoDataUrl('/images/logo/logo.png');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FinSightIA — Documentación de Casos de Uso</title>
<style>${construirEstilosHtml()}</style>
</head>
<body>
  <div class="toolbar no-print">
    <img class="toolbar-logo" src="${logoDataUrl}" alt="FinSightIA" />
    <div class="toolbar-actions">
      <button class="primary" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
      <button onclick="const b=new Blob(['&lt;!doctype html&gt;'+document.documentElement.outerHTML],{type:'text/html'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='FinSightIA_Casos_de_Uso.html';a.click();">⬇️ Descargar HTML</button>
    </div>
  </div>

  <main class="page">
    <header class="profile-header">
      <div class="profile-banner"></div>
      <div class="profile-body">
        <img class="profile-avatar" src="https://media.licdn.com/dms/image/v2/D4E03AQFKYAvoN8j-Gg/profile-displayphoto-crop_800_800/B4EZkpnRqMGYAI-/0/1757339787084?e=1787788800&v=beta&t=f3w4OVcBkiXGGRLjjCaBExk8qqx9_WQxa60IrUMOBHI" alt="Felipe Pereira Alarcón" />
        <div class="profile-info">
          <h1>Felipe Pereira Alarcón</h1>
          <p class="role">Documentación de Casos de Uso — FinSightIA</p>
          <div class="profile-links">
            <a class="gh" href="https://github.com/fpereira22" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="${ICONO_GITHUB}"/></svg> GitHub</a>
            <a class="li" href="https://www.linkedin.com/in/felipe-pereira-alarcon/" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#fff"/><text x="12" y="17" font-family="Arial,sans-serif" font-size="12" font-weight="800" fill="#0a66c2" text-anchor="middle">in</text></svg> LinkedIn</a>
            <a class="pf" href="https://fpereiradev.sppa.cl/" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.4 2.4 3.8 5.8 3.8 9.5s-1.4 7.1-3.8 9.5c-2.4-2.4-3.8-5.8-3.8-9.5S9.6 4.9 12 2.5Z"/></svg> Portfolio</a>
          </div>
        </div>
      </div>
      <div class="profile-stats">
        <span class="stat-chip">${cuGrupos.length} casos de uso</span>
        <span class="stat-chip">${totalDiagramas} diagramas de secuencia</span>
        <span class="stat-chip">${totalCategorias} categorías</span>
        <span class="stat-chip">Generado el ${fecha}</span>
      </div>
    </header>

    <div class="doc-title">
      <h1>FinSightIA — Documentación de Casos de Uso</h1>
      <p>Patrón Boundary–Control–Entity (BCE) · Backend Java/Spring, AI-Service Python/FastAPI, Frontend React</p>
    </div>

    <nav class="index-nav">${indiceHtml}</nav>

    ${cuerpoHtml}

    <footer class="doc-footer">Generado automáticamente por FinSightIA · use-case-generator</footer>
  </main>
</body>
</html>`;
}

export default function MermaidPreview() {
  const [entrada, setEntrada] = useState(PLACEHOLDER);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [seleccionado, setSeleccionado] = useState(0);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [generandoExcel, setGenerandoExcel] = useState(false);
  const [generandoHtml, setGenerandoHtml] = useState(false);
  const [documentoHtml, setDocumentoHtml] = useState<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const modoArchivoRef = useRef<'html' | 'excel'>('html');

  // Si el texto pegado trae uno o más bloques ```mermaid (un .md completo),
  // se listan como pestañas; si no, se trata como código Mermaid puro.
  useEffect(() => {
    const detectados = extraerBloquesMermaid(entrada);
    if (detectados.length > 0) {
      setBloques(detectados);
      setSeleccionado((prev) => (prev < detectados.length ? prev : 0));
    } else {
      setBloques([]);
      setSeleccionado(0);
    }
  }, [entrada]);

  const codigoActivo = useMemo(() => {
    const crudo = bloques.length > 0 ? bloques[seleccionado]?.codigo ?? '' : entrada.trim();
    return normalizarParticipantesBce(crudo);
  }, [bloques, seleccionado, entrada]);

  useEffect(() => {
    let cancelado = false;
    const id = `mermaid-preview-${++renderIdRef.current}`;

    if (!codigoActivo) {
      setSvg('');
      setError('');
      return;
    }

    mermaid
      .render(id, codigoActivo)
      .then(({ svg: svgRenderizado }) => {
        if (!cancelado) {
          setSvg(svgRenderizado);
          setError('');
        }
      })
      .catch((err: Error) => {
        if (!cancelado) {
          setSvg('');
          setError(err.message || 'No se pudo interpretar el diagrama.');
        }
      });

    return () => {
      cancelado = true;
    };
  }, [codigoActivo]);

  const descargarSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(bloques[seleccionado]?.titulo || 'diagrama').replace(/\s+/g, '_')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const descargarPng = async () => {
    if (!svg || !contenedorRef.current) return;
    const svgEl = contenedorRef.current.querySelector('svg');
    if (!svgEl) return;

    const { width, height } = svgEl.getBoundingClientRect();
    const escala = 2; // exporta a 2x para nitidez

    const svgConNamespace = svgEl.cloneNode(true) as SVGSVGElement;
    svgConNamespace.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!svgConNamespace.getAttribute('width')) svgConNamespace.setAttribute('width', String(width));
    if (!svgConNamespace.getAttribute('height')) svgConNamespace.setAttribute('height', String(height));

    const svgTexto = new XMLSerializer().serializeToString(svgConNamespace);
    const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgTexto)))}`;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * escala;
      canvas.height = height * escala;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(escala, escala);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(bloques[seleccionado]?.titulo || 'diagrama').replace(/\s+/g, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.onerror = () => {
      Swal.fire({ icon: 'error', title: 'No se pudo exportar la imagen' });
    };
    img.src = svgBase64;
  };

  /**
   * Arma el mismo tipo de planilla que `docs/casos_uso.xlsx` (hoja "Todos los casos
   * de uso" + una hoja filtrada por cada categoría, sin diseños ni imágenes), pero
   * parseando el .md en vivo en vez de tener los 18 casos escritos a mano.
   */
  const generarExcelDocumento = async (textoOverride?: string) => {
    const texto = textoOverride ?? entrada;
    if (!texto.trim()) return;
    setGenerandoExcel(true);
    try {
      const filas = extraerFilasParaExcel(texto);
      if (!filas.length) throw new Error('No se encontró ningún caso de uso ("# CUxx - ...") en el texto.');

      const wb = new ExcelJS.Workbook();
      wb.creator = 'FinSightIA - use-case-generator';
      wb.created = new Date();

      const headerRow = [
        'ID', 'Nombre', 'Tipo', 'Actores', 'Boundary', 'Control', 'Entity',
        'Precondiciones', 'Postcondiciones', 'Flujo Principal', 'Alternativas / Errores', 'Endpoints',
      ];
      const colWidths = [8, 32, 22, 20, 22, 30, 26, 40, 40, 55, 55, 40];

      const estilarHoja = (ws: ExcelJS.Worksheet) => {
        ws.columns = colWidths.map((w) => ({ width: w }));
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(65 + headerRow.length - 1)}1` };
      };
      const agregarFilas = (ws: ExcelJS.Worksheet, items: FilaExcel[]) => {
        for (const f of items) {
          const row = ws.addRow([
            f.id, f.nombre, f.tipo, f.actores, f.boundary, f.control, f.entity,
            f.precondiciones, f.postcondiciones, f.flujoPrincipal, f.alternativas, f.endpoints,
          ]);
          row.alignment = { vertical: 'top', wrapText: true };
        }
      };

      const wsTodos = wb.addWorksheet('Todos los casos de uso');
      wsTodos.addRow(headerRow);
      estilarHoja(wsTodos);
      agregarFilas(wsTodos, filas);

      const tipos = [...new Set(filas.map((f) => f.tipo))];
      for (const tipo of tipos) {
        const ws = wb.addWorksheet(tipo.substring(0, 31)); // límite de Excel para nombres de hoja
        ws.addRow(headerRow);
        estilarHoja(ws);
        agregarFilas(ws, filas.filter((f) => f.tipo === tipo));
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'FinSightIA_Casos_de_Uso.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'No se pudo generar el Excel', text: (err as Error).message });
    } finally {
      setGenerandoExcel(false);
    }
  };

  /**
   * Genera el documento HTML visual completo (portada, índice, tarjetas por caso de
   * uso, diagramas como SVG vectorial) y lo deja en `documentoHtml` para mostrarlo
   * en un iframe DENTRO de esta misma página (ver JSX más abajo). Se descartó abrir
   * una pestaña nueva con `window.open`: incluso abriéndola de forma síncrona, varios
   * navegadores igual la bloquean según su configuración de ventanas emergentes — el
   * iframe en la misma página no depende de ningún permiso y siempre se ve.
   */
  const generarYMostrarHtml = async (texto: string) => {
    setGenerandoHtml(true);
    try {
      const html = await generarHtmlDocumento(texto);
      setDocumentoHtml(html);
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'No se pudo generar el documento', text: (err as Error).message });
    } finally {
      setGenerandoHtml(false);
    }
  };

  /** Abre el selector nativo; `modo` decide si al elegir el archivo se genera el documento visual o el Excel. */
  const elegirArchivo = (modo: 'html' | 'excel') => {
    modoArchivoRef.current = modo;
    inputArchivoRef.current?.click();
  };

  const onArchivoElegido = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si se repite la acción
    if (!archivo) return;

    const texto = await archivo.text();
    setEntrada(texto);

    if (modoArchivoRef.current === 'html') await generarYMostrarHtml(texto);
    else await generarExcelDocumento(texto);
  };

  const copiarCodigo = async () => {
    await navigator.clipboard.writeText(codigoActivo);
    await Swal.fire({
      icon: 'success',
      title: 'Código copiado',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  if (documentoHtml) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
          <span className="text-xs font-medium text-gray-500">
            Vista previa del documento — el botón para exportar a PDF está dentro, en la barra de arriba del
            propio documento.
          </span>
          <Button variant="outline" onClick={() => setDocumentoHtml(null)}>
            ✕ Cerrar vista previa
          </Button>
        </div>
        <iframe
          title="Documento de casos de uso"
          srcDoc={documentoHtml}
          className="h-full w-full flex-1 border-0"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Vista previa de diagramas Mermaid
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Página interna sin enlace en el menú. Elegí <code>docs/casos_uso.md</code> para generar el documento
          oficial (portada, índice y una tarjeta prolija por caso de uso con sus 2 diagramas), o pegá código
          suelto abajo para revisarlo diagrama por diagrama.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <input
          ref={inputArchivoRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          className="hidden"
          onChange={onArchivoElegido}
        />
        <Button onClick={() => elegirArchivo('html')} disabled={generandoHtml || generandoExcel}>
          {generandoHtml ? 'Generando documento…' : 'Elegir docs/casos_uso.md y ver documento'}
        </Button>
        <Button variant="outline" onClick={() => elegirArchivo('excel')} disabled={generandoHtml || generandoExcel}>
          {generandoExcel ? 'Generando Excel…' : 'Elegir archivo y generar Excel'}
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          El primer botón muestra el documento visual acá mismo (diagramas vectoriales, portada con tu perfil);
          desde esa vista podés imprimir/guardar como PDF o descargar el .html. El segundo genera el mismo tipo de
          planilla de <code>docs/casos_uso.xlsx</code> (una hoja con todos los casos + una hoja por categoría),
          sin diseños ni imágenes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-3">
          <textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            spellCheck={false}
            className="h-[520px] w-full rounded-2xl border border-gray-200 bg-white p-4 font-mono text-xs leading-relaxed text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
            placeholder="Pega aquí código Mermaid o el .md completo con bloques ```mermaid"
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={copiarCodigo} disabled={!codigoActivo}>
              Copiar código activo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEntrada('')}
            >
              Limpiar
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {bloques.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {bloques.map((bloque, i) => (
                <button
                  key={i}
                  onClick={() => setSeleccionado(i)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    i === seleccionado
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.1]'
                  }`}
                >
                  {bloque.titulo}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={descargarPng} disabled={!svg}>
              Exportar PNG
            </Button>
            <Button variant="outline" onClick={descargarSvg} disabled={!svg}>
              Exportar SVG
            </Button>
          </div>

          <div className="min-h-[560px] overflow-auto rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.02]">
            {error && (
              <p className="whitespace-pre-wrap text-sm text-error-500">{error}</p>
            )}
            {!error && svg && (
              // eslint-disable-next-line react/no-danger -- SVG generado localmente por mermaid.render, no viene de terceros
              <div ref={contenedorRef} dangerouslySetInnerHTML={{ __html: svg }} />
            )}
            {!error && !svg && (
              <p className="text-sm text-gray-400">Escribe o pega código Mermaid para ver la vista previa.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
