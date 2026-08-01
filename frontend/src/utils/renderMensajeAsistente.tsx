import type { ReactNode } from "react";

function renderConNegritas(text: string) {
  const partes = text.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    const match = parte.match(/^\*\*([^*]+)\*\*$/);
    if (match) {
      return <strong key={i}>{match[1]}</strong>;
    }
    return parte;
  });
}

/** Renderiza negritas (dobles asteriscos) y viñetas (guion o asterisco) del
 * texto plano de un mensaje del asistente, sin un parser de markdown completo. */
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
