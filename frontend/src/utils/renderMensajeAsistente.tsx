import type { ReactNode } from "react";
import { notifySupportMailOpened } from "./supportSuccess";

const ESQUEMAS_PERMITIDOS = /^(https?:|mailto:|\/)/i;

function renderConNegritas(text: string) {
  const partes = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);

  return partes.map((parte, i) => {
    const matchNegrita = parte.match(/^\*\*([^*]+)\*\*$/);

    if (matchNegrita) {
      return <strong key={i}>{matchNegrita[1]}</strong>;
    }

    const matchEnlace = parte.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (matchEnlace && ESQUEMAS_PERMITIDOS.test(matchEnlace[2])) {
      const texto = matchEnlace[1];
      const href = matchEnlace[2];
      const esInterno = href.startsWith("/");

      return (
        <a
          key={i}
          href={href}
          onClick={href.startsWith("mailto:") ? notifySupportMailOpened : undefined}
          target={esInterno ? undefined : "_blank"}
          rel={esInterno ? undefined : "noopener noreferrer"}
          className={
            esInterno
              ? "inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 font-medium text-white transition hover:bg-brand-600"
              : "text-brand-500 underline hover:text-brand-600"
          }
        >
          {texto}
        </a>
      );
    }

    return parte;
  });
}

/**
 * Renderiza negritas, enlaces Markdown y viñetas del texto plano
 * de un mensaje del asistente, sin utilizar un parser completo.
 */
export function renderMensajeAsistente(text: string) {
  const lineas = text.split("\n");
  const bloques: ReactNode[] = [];
  let viñetaActual: string[] = [];

  const cerrarViñetas = () => {
    if (viñetaActual.length === 0) {
      return;
    }

    bloques.push(
      <ul key={`ul-${bloques.length}`} className="list-disc space-y-1 pl-5">
        {viñetaActual.map((item, i) => (
          <li key={i}>{renderConNegritas(item)}</li>
        ))}
      </ul>,
    );

    viñetaActual = [];
  };

  lineas.forEach((linea, i) => {
    const match = linea.match(/^\s*[*-]\s+(.*)$/);

    if (match) {
      viñetaActual.push(match[1]);
      return;
    }

    cerrarViñetas();

    if (linea.trim() !== "") {
      bloques.push(
        <p key={`p-${bloques.length}`}>{renderConNegritas(linea)}</p>,
      );
    } else if (i !== lineas.length - 1) {
      bloques.push(<div key={`br-${bloques.length}`} className="h-2" />);
    }
  });

  cerrarViñetas();

  return <div className="space-y-2">{bloques}</div>;
}
