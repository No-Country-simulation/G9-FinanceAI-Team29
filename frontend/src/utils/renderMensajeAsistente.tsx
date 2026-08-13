import { useEffect, useRef, type ReactNode } from "react";
import { notifySupportMailOpened } from "./supportSuccess";
import TerminalDemo from "../components/ai/TerminalDemo";
import { detenerOtrosEasterEggs, registrarEasterEgg } from "./easterEggPlayback";

const ESQUEMAS_PERMITIDOS = /^(https?:|mailto:|\/)/i;

/** Debe coincidir exactamente con la respuesta del easter egg "hello_world" en el backend. */
const MARCADOR_TERMINAL_DEMO = "[[finsi-terminal-demo]]";

/** Debe coincidir con la respuesta del easter egg "exit" en el backend. */
const MARCADOR_LOGOUT = "[[finsi-logout]]";

/**
 * Marcador interno que usa Finsi para conservar contexto financiero
 * entre mensajes. Debe mantenerse en el texto original, pero nunca
 * mostrarse visualmente al usuario.
 */
const CONTEXTO_FINANCIERO_INTERNO =
  /<!--\s*\*?finsi-financial-context[\s\S]*?-->/gi;

function limpiarMetadataInterna(texto: string): string {
  return texto
    .replace(CONTEXTO_FINANCIERO_INTERNO, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * <audio> autoplay de un easter egg. Se registra en el controlador
 * compartido para que, si empieza a sonar otro easter egg, este se corte
 * de inmediato en vez de seguir sonando en paralelo.
 */
function EasterEggAudioTag({ src, messageId }: { src: string; messageId?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (messageId === undefined) return;

    detenerOtrosEasterEggs(messageId);

    return registrarEasterEgg(messageId, () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }, [messageId]);

  return <audio ref={audioRef} src={src} autoPlay className="hidden" />;
}

function renderConNegritas(text: string, messageId?: number) {
  const partes = text.split(
    /(\*\*[^*]+\*\*|!video\[[^\]]*\]\([^)]+\)|!audio\[[^\]]*\]\([^)]+\)|!icon\[[^\]]*\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g,
  );

  return partes.map((parte, i) => {
    const matchNegrita = parte.match(/^\*\*([^*]+)\*\*$/);

    if (matchNegrita) {
      return <strong key={i}>{matchNegrita[1]}</strong>;
    }

    const matchAudio = parte.match(
      /^!audio\[([^\]]*)\]\(([^)]+)\)$/,
    );

    if (
      matchAudio &&
      ESQUEMAS_PERMITIDOS.test(matchAudio[2])
    ) {
      return (
        <EasterEggAudioTag key={i} src={matchAudio[2]} messageId={messageId} />
      );
    }

    const matchIcono = parte.match(
      /^!icon\[([^\]]*)\]\(([^)]+)\)$/,
    );

    if (
      matchIcono &&
      ESQUEMAS_PERMITIDOS.test(matchIcono[2])
    ) {
      return (
        <img
          key={i}
          src={matchIcono[2]}
          alt={matchIcono[1]}
          loading="lazy"
          className="ml-1 inline-block h-[1em] w-[1em] align-middle"
        />
      );
    }

    const matchVideo = parte.match(
      /^!video\[([^\]]*)\]\(([^)]+)\)$/,
    );

    if (
      matchVideo &&
      ESQUEMAS_PERMITIDOS.test(matchVideo[2])
    ) {
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

    const matchImagen = parte.match(
      /^!\[([^\]]*)\]\(([^)]+)\)$/,
    );

    if (
      matchImagen &&
      ESQUEMAS_PERMITIDOS.test(matchImagen[2])
    ) {
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

    const matchEnlace = parte.match(
      /^\[([^\]]+)\]\(([^)]+)\)$/,
    );

    if (
      matchEnlace &&
      ESQUEMAS_PERMITIDOS.test(matchEnlace[2])
    ) {
      const texto = matchEnlace[1];
      const href = matchEnlace[2];
      const esInterno = href.startsWith("/");

      return (
        <a
          key={i}
          href={href}
          onClick={
            href.startsWith("mailto:")
              ? notifySupportMailOpened
              : undefined
          }
          target={esInterno ? undefined : "_blank"}
          rel={
            esInterno
              ? undefined
              : "noopener noreferrer"
          }
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
export function renderMensajeAsistente(text: string, messageId?: number): ReactNode {
  const textoVisible = limpiarMetadataInterna(text);

  if (textoVisible.includes(MARCADOR_TERMINAL_DEMO)) {
    const resto = textoVisible
      .replace(MARCADOR_TERMINAL_DEMO, "")
      .trim();

    return (
      <>
        <TerminalDemo />

        {resto && (
          <div className="mt-3">
            {renderMensajeAsistente(resto, messageId)}
          </div>
        )}
      </>
    );
  }

  if (textoVisible.includes(MARCADOR_LOGOUT)) {
    // El logout lo dispara AsistenteIA (solo con el mensaje fresco, no en el
    // historial). Acá solo ocultamos el marcador y mostramos el texto.
    const resto = textoVisible
      .replace(MARCADOR_LOGOUT, "")
      .trim();

    return <>{resto && renderMensajeAsistente(resto, messageId)}</>;
  }

  const lineas = textoVisible.split("\n");
  const bloques: ReactNode[] = [];
  let viñetaActual: string[] = [];

  const cerrarViñetas = () => {
    if (viñetaActual.length === 0) {
      return;
    }

    bloques.push(
      <ul
        key={`ul-${bloques.length}`}
        className="list-disc space-y-1 pl-5"
      >
        {viñetaActual.map((item, i) => (
          <li key={i}>
            {renderConNegritas(item, messageId)}
          </li>
        ))}
      </ul>,
    );

    viñetaActual = [];
  };

  lineas.forEach((linea, i) => {
    const match = linea.match(
      /^\s*[-*]\s+(.*)$/,
    );

    if (match) {
      viñetaActual.push(match[1]);
      return;
    }

    cerrarViñetas();

    if (linea.trim() !== "") {
      bloques.push(
        <p key={`p-${bloques.length}`}>
          {renderConNegritas(linea, messageId)}
        </p>,
      );
    } else if (i !== lineas.length - 1) {
      bloques.push(
        <div
          key={`br-${bloques.length}`}
          className="h-2"
        />,
      );
    }
  });

  cerrarViñetas();

  return <>{bloques}</>;
}