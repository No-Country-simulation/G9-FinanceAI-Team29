import type { ReactNode } from "react";

const ESQUEMAS_PERMITIDOS = /^(https?:|mailto:)/i;

function renderConNegritas(text: string) {
  const partes = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return partes.map((parte, i) => {
    const matchNegrita = parte.match(/^\*\*([^*]+)\*\*$/);
    if (matchNegrita) {
      return <strong key={i}>{matchNegrita[1]}</strong>;
    }
    const matchEnlace = parte.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (matchEnlace && ESQUEMAS_PERMITIDOS.test(matchEnlace[2])) {
      return (
        <a
          key={i}
          href={matchEnlace[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-500 underline hover:text-brand-600"
        >
          {matchEnlace[1]}
        </a>
      );
    }
    return parte;
  });
}

/** Renderiza negritas (dobles asteriscos), enlaces (`[texto](url)`) y viñetas
 * (guion o asterisco) del texto plano de un mensaje del asistente, sin un
 * parser de markdown completo. */
export function renderMensajeAsistente(text: string) {
  const lineas = text.split("\n");
  const bloques: ReactNode[] = [];
  let viñetaActual: string[] = [];

  const cerrarViñetas = () => {
    if (viñetaActual.length > 0) {
      bloques.push(
        <ul key={`ul-${bloques.length}`} className="list-disc space-y-1 pl-5">
          {viñetaActual.map((item, i) => (
            <li key={i}>{renderConNegritas(item)}</li>
          ))}
        </ul>
      );
      viñetaActual = [];
    }
  };

  lineas.forEach((linea, i) => {
    const match = linea.match(/^\s*[*-]\s+(.*)$/);
    if (match) {
      viñetaActual.push(match[1]);
    } else {
      cerrarViñetas();
      if (linea.trim() !== "") {
        bloques.push(<p key={`p-${bloques.length}`}>{renderConNegritas(linea)}</p>);
      } else if (i !== lineas.length - 1) {
        bloques.push(<div key={`br-${bloques.length}`} className="h-2" />);
      }
    }
  });
  cerrarViñetas();

  return <div className="space-y-2">{bloques}</div>;
}
