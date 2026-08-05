import { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
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

export default function MermaidPreview() {
  const [entrada, setEntrada] = useState(PLACEHOLDER);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [seleccionado, setSeleccionado] = useState(0);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const contenedorRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);

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

  const copiarCodigo = async () => {
    await navigator.clipboard.writeText(codigoActivo);
    await Swal.fire({
      icon: 'success',
      title: 'Código copiado',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Vista previa de diagramas Mermaid
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Página interna sin enlace en el menú. Pega el código de un bloque <code>```mermaid</code> suelto, o
          directamente el contenido completo de un <code>.md</code> generado por la skill de casos de uso
          (como <code>docs/UC-05-crear-meta-financiera.md</code>) para navegar entre sus diagramas y exportarlos.
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
