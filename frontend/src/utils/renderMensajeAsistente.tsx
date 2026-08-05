import type { ReactNode } from "react";
import { notifySupportMailOpened } from "./supportSuccess";
import TerminalDemo from "../components/ai/TerminalDemo";

const ESQUEMAS_PERMITIDOS = /^(https?:|mailto:|\/)/i;

/** Debe coincidir exactamente con la respuesta del easter egg "hello_world" en el backend. */
const MARCADOR_TERMINAL_DEMO = "[[finsi-terminal-demo]]";

function renderConNegritas(text: string) {
  const partes = text.split(
    /(\*\*[^*]+\*\*|!video\[[^\]]*\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g,
  );

  return partes.map((parte, i) => {
    const matchNegrita = parte.match(/^\*\*([^*]+)\*\*$/);

    if (matchNegrita) {
      return <strong key={i}>{matchNegrita[1]}</strong>;
    }

    const matchVideo = parte.match(/^!video\[([^\]]*)\]\(([^)]+)\)$/);

    if (matchVideo && ESQUEMAS_PERMITIDOS.test(matchVideo[2])) {
      return (
        <iframe
          key={i}
          src={matchVideo[2]}
          title={matchVideo[1] || "video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="mt-2 aspect-video w-full max-w-md rounded-lg border-0"
        />
      );
    }

    const matchImagen = parte.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

    if (matchImagen && ESQUEMAS_PERMITIDOS.test(matchImagen[2])) {
      return (
        <img
          key={i}
          src={matchImagen[2]}
          alt={matchImagen[1]}
          loading="lazy"
          className="mt-2 max-h-64 w-auto rounded-lg"
        />
      );
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
  if (text.includes(MARCADOR_TERMINAL_DEMO)) {
    const resto = text.replace(MARCADOR_TERMINAL_DEMO, "").trim();
    return (
      <div className="space-y-2">
        {resto && renderMensajeAsistente(resto)}
        <TerminalDemo />
      </div>
    );
  }

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
