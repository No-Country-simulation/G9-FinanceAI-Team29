import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaWhatsapp,
  FaXTwitter,
} from 'react-icons/fa6';

import type {
  AchievementCategoria,
  AchievementDef,
  AchievementId,
} from '../../data/achievements';

import {
  LockIcon,
  LockOpenIcon,
} from '../../icons';

/* ============================================================
   PROPS
   ============================================================ */

interface AchievementsListProps {
  catalogo: AchievementDef[];
  desbloqueados: AchievementId[];
  onPistaCompleta?: () => void;
}

/* ============================================================
   LOGROS ESPECIALES BLOQUEADOS
   ============================================================ */

const ESPECIALES: AchievementId[] = [
  'rickroll',
  'admin_click_frenzy',
  'skynet',
];

/* ============================================================
   LOGROS COMPARTIBLES
   ============================================================ */

const LOGROS_COMPARTIBLES: AchievementId[] = [
  'matrix',
  'got',
  'abrazo',
];

/* ============================================================
   ANIMACIONES DEL MODAL
   ============================================================ */

const ANIMACIONES_LOGROS: Partial<Record<AchievementId, string>> = {
  matrix: '/images/mascot/finsi-matrix.webm',
  got: '/images/mascot/finsi-got.webm',
  abrazo: '/images/mascot/finsi-hug.webm',
};

/* ============================================================
   CONFIGURACIÓN DE PISTAS
   ============================================================ */

const CLICKS_PARA_REGANO = 3;
const CLICKS_PARA_PISTA = 6;
const DURACION_MENSAJE_MS = 2500;

const FRASES_REGANO = [
  '¿Qué haces? Así no vas a conseguir nada 😅',
  'Hacer clic sin parar no lo va a desbloquear, ¿sabes?',
  'Ese candado no se abre a base de clics...',
];

/* ============================================================
   RUNAS
   ============================================================ */

const RUNAS =
  'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'.split('');

function textoMisterioso(seed: string): string {
  let h = 0;

  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return seed
    .split(' ')
    .map((palabra) => {
      let out = '';

      for (
        let i = 0;
        i < Math.max(2, Math.min(palabra.length, 9));
        i += 1
      ) {
        h = (h * 1103515245 + 12345) >>> 0;
        out += RUNAS[h % RUNAS.length];
      }

      return out;
    })
    .join(' ');
}

/* ============================================================
   SHARE
   ============================================================ */

function crearTextoCompartir(logro: AchievementDef): string {
  return `Usé FinSightAI y desbloqueé el logro "${logro.titulo}" 🎉

${logro.descripcion}

Un paso más para seguir entendiendo mejor mis finanzas.

#FinSightAI #FinanzasPersonales`;
}

function obtenerUrlCompartir(): string {
  return 'https://finsight.ai.sppa.cl/';
}

function abrirVentanaCompartir(url: string): void {
  window.open(
    url,
    '_blank',
    'noopener,noreferrer,width=720,height=650',
  );
}

/* ============================================================
   PORTAPAPELES
   ============================================================ */

async function copiarAlPortapapeles(
  texto: string,
): Promise<boolean> {
  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(texto);
      return true;
    }

    const textarea =
      document.createElement('textarea');

    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const resultado =
      document.execCommand('copy');

    document.body.removeChild(textarea);

    return resultado;
  } catch (error) {
    console.error(
      'No se pudo copiar al portapapeles:',
      error,
    );

    return false;
  }
}

/* ============================================================
   COMPONENTE
   ============================================================ */

export default function AchievementsList({
  catalogo,
  desbloqueados,
  onPistaCompleta,
}: AchievementsListProps) {
  const [
    shakingId,
    setShakingId,
  ] = useState<AchievementId | null>(
    null,
  );

  const [
    clicks,
    setClicks,
  ] = useState<
    Partial<Record<AchievementId, number>>
  >({});

  const [
    mensajeVisibleId,
    setMensajeVisibleId,
  ] = useState<AchievementId | null>(
    null,
  );

  const ocultarMensajeTimeout =
    useRef<number | undefined>(
      undefined,
    );

  /* ==========================================================
     SHARE
     ========================================================== */

  const [
    logroCompartiendo,
    setLogroCompartiendo,
  ] = useState<AchievementDef | null>(
    null,
  );

  const [
    textoCopiado,
    setTextoCopiado,
  ] = useState(false);

  /* ==========================================================
     TEXTOS MISTERIOSOS
     ========================================================== */

  const misteriosos =
    useMemo(() => {
      const mapa =
        new Map<AchievementId, string>();

      catalogo.forEach((logro) => {
        mapa.set(
          logro.id,
          textoMisterioso(logro.id),
        );
      });

      return mapa;
    }, [catalogo]);

  /* ==========================================================
     REGAÑOS
     ========================================================== */

  const reganos =
    useMemo(() => {
      const mapa =
        new Map<AchievementId, string>();

      catalogo.forEach((logro, i) => {
        mapa.set(
          logro.id,
          FRASES_REGANO[
            i % FRASES_REGANO.length
          ],
        );
      });

      return mapa;
    }, [catalogo]);

  /* ==========================================================
     CLICK EN LOGRO BLOQUEADO
     ========================================================== */

  function handleClickBloqueado(
    id: AchievementId,
  ) {
    setShakingId(id);

    window.setTimeout(() => {
      setShakingId((actual) =>
        actual === id
          ? null
          : actual,
      );
    }, 450);

    const nuevoConteo =
      (clicks[id] ?? 0) + 1;

    setClicks((actual) => ({
      ...actual,
      [id]: nuevoConteo,
    }));

    if (
      nuevoConteo ===
      CLICKS_PARA_PISTA
    ) {
      onPistaCompleta?.();
    }

    if (
      nuevoConteo >=
      CLICKS_PARA_REGANO
    ) {
      setMensajeVisibleId(id);

      window.clearTimeout(
        ocultarMensajeTimeout.current,
      );

      ocultarMensajeTimeout.current =
        window.setTimeout(() => {
          setMensajeVisibleId(
            (actual) =>
              actual === id
                ? null
                : actual,
          );
        }, DURACION_MENSAJE_MS);
    }
  }

  /* ==========================================================
     ABRIR / CERRAR SHARE
     ========================================================== */

  function abrirCompartir(
    logro: AchievementDef,
  ) {
    if (
      !LOGROS_COMPARTIBLES.includes(
        logro.id,
      )
    ) {
      return;
    }

    setLogroCompartiendo(logro);
    setTextoCopiado(false);
  }

  function cerrarCompartir() {
    setLogroCompartiendo(null);
    setTextoCopiado(false);
  }

  /* ==========================================================
     COPIAR
     ========================================================== */

  async function copiarTexto() {
    if (!logroCompartiendo) {
      return;
    }

    const texto =
      crearTextoCompartir(
        logroCompartiendo,
      );

    const copiado =
      await copiarAlPortapapeles(
        texto,
      );

    if (!copiado) {
      return;
    }

    setTextoCopiado(true);

    window.setTimeout(() => {
      setTextoCopiado(false);
    }, 2000);
  }

  /* ==========================================================
     WHATSAPP
     ========================================================== */

  async function compartirWhatsapp() {
    if (!logroCompartiendo) {
      return;
    }

    const texto =
      crearTextoCompartir(
        logroCompartiendo,
      );

    const url =
      obtenerUrlCompartir();

    await copiarAlPortapapeles(
      texto,
    );

    abrirVentanaCompartir(
      `https://wa.me/?text=${encodeURIComponent(
        `${texto}\n\n${url}`,
      )}`,
    );
  }

  /* ==========================================================
     LINKEDIN
     ========================================================== */

  async function compartirLinkedIn() {
    if (!logroCompartiendo) {
      return;
    }

    const texto =
      crearTextoCompartir(
        logroCompartiendo,
      );

    await copiarAlPortapapeles(
      texto,
    );

    abrirVentanaCompartir(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        obtenerUrlCompartir(),
      )}`,
    );
  }

  /* ==========================================================
     INSTAGRAM
     ========================================================== */

  async function compartirInstagram() {
    if (!logroCompartiendo) {
      return;
    }

    const texto =
      crearTextoCompartir(
        logroCompartiendo,
      );

    await copiarAlPortapapeles(
      texto,
    );

    window.open(
      'https://www.instagram.com/',
      '_blank',
      'noopener,noreferrer',
    );
  }

  /* ==========================================================
     FACEBOOK
     ========================================================== */

  async function compartirFacebook() {
    if (!logroCompartiendo) {
      return;
    }

    const texto =
      crearTextoCompartir(
        logroCompartiendo,
      );

    await copiarAlPortapapeles(
      texto,
    );

    abrirVentanaCompartir(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        obtenerUrlCompartir(),
      )}`,
    );
  }

  /* ==========================================================
     X
     ========================================================== */

  async function compartirX() {
    if (!logroCompartiendo) {
      return;
    }

    const texto =
      crearTextoCompartir(
        logroCompartiendo,
      );

    await copiarAlPortapapeles(
      texto,
    );

    abrirVentanaCompartir(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        texto,
      )}&url=${encodeURIComponent(
        obtenerUrlCompartir(),
      )}`,
    );
  }

  /* ==========================================================
     GRID
     ========================================================== */

  function renderGrid(
    items: AchievementDef[],
  ) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((logro) => {
          const desbloqueado =
            desbloqueados.includes(
              logro.id,
            );

          const especial =
            ESPECIALES.includes(
              logro.id,
            );

          const compartible =
            desbloqueado &&
            LOGROS_COMPARTIBLES.includes(
              logro.id,
            );

          const clicksLogro =
            clicks[logro.id] ?? 0;

          const mensaje =
            desbloqueado ||
            mensajeVisibleId !==
              logro.id
              ? null
              : clicksLogro >=
                  CLICKS_PARA_PISTA
                ? `Pista: ${logro.pista}`
                : clicksLogro >=
                    CLICKS_PARA_REGANO
                  ? reganos.get(
                      logro.id,
                    )
                  : null;

          return (
            <div
              key={logro.id}
              title={
                desbloqueado
                  ? logro.descripcion
                  : '???'
              }
              role={
                desbloqueado
                  ? undefined
                  : 'button'
              }
              tabIndex={
                desbloqueado
                  ? undefined
                  : 0
              }
              onClick={
                desbloqueado
                  ? undefined
                  : () =>
                      handleClickBloqueado(
                        logro.id,
                      )
              }
              onKeyDown={
                desbloqueado
                  ? undefined
                  : (event) => {
                      if (
                        event.key ===
                          'Enter' ||
                        event.key === ' '
                      ) {
                        event.preventDefault();

                        handleClickBloqueado(
                          logro.id,
                        );
                      }
                    }
              }
              className={`relative flex w-full flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                desbloqueado
                  ? 'cursor-default border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10'
                  : 'cursor-pointer border-gray-200 bg-gray-50 opacity-70 hover:opacity-90 dark:border-gray-800 dark:bg-white/[0.02]'
              } ${
                !desbloqueado &&
                especial
                  ? 'animate-achievement-locked-special-glow'
                  : ''
              } ${
                shakingId ===
                logro.id
                  ? 'animate-achievement-locked-shake'
                  : ''
              }`}
            >
              {desbloqueado && (
                <LockOpenIcon className="absolute right-2 top-2 h-3.5 w-3.5 text-brand-400 dark:text-brand-400/80" />
              )}

              {desbloqueado ? (
                logro.imagenUrl ? (
                  <img
                    src={logro.imagenUrl}
                    alt=""
                    className={`rounded-sm object-contain ${
                      logro.id ===
                      'equipo_descubierto'
                        ? 'h-20 w-20'
                        : 'h-12 w-12'
                    }`}
                  />
                ) : (
                  <span className="text-2xl">
                    {logro.emoji}
                  </span>
                )
              ) : (
                <LockIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
              )}

              <span
                className={`text-sm font-medium ${
                  desbloqueado
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'select-none tracking-wide text-gray-400 dark:text-gray-600'
                }`}
              >
                {desbloqueado
                  ? logro.titulo
                  : misteriosos.get(
                      logro.id,
                    )}
              </span>

              {mensaje && (
                <span className="text-xs font-medium leading-snug text-red-500 dark:text-red-400">
                  {mensaje}
                </span>
              )}

              {compartible && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();

                    abrirCompartir(
                      logro,
                    );
                  }}
                  title={`Compartir ${logro.titulo}`}
                  aria-label={`Compartir logro ${logro.titulo}`}
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-brand-600 transition hover:border-brand-300 hover:bg-white hover:text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20 dark:hover:text-brand-200"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle
                      cx="18"
                      cy="5"
                      r="3"
                    />

                    <circle
                      cx="6"
                      cy="12"
                      r="3"
                    />

                    <circle
                      cx="18"
                      cy="19"
                      r="3"
                    />

                    <path d="m8.59 13.51 6.83 3.98" />

                    <path d="m15.41 6.51-6.82 3.98" />
                  </svg>

                  Compartir
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ==========================================================
     SECCIONES
     ========================================================== */

  function renderSeccion(
    titulo: string,
    subtitulo: string,
    categoria: AchievementCategoria,
  ) {
    const items =
      catalogo.filter(
        (logro) =>
          logro.categoria ===
          categoria,
      );

    if (items.length === 0) {
      return null;
    }

    const desbloqueadosCount =
      items.filter((logro) =>
        desbloqueados.includes(
          logro.id,
        ),
      ).length;

    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {titulo}
            </h4>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {subtitulo}
            </p>
          </div>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {desbloqueadosCount}{' '}
            / {items.length}
          </span>
        </div>

        {renderGrid(items)}
      </div>
    );
  }

  /* ==========================================================
     MODAL
     ========================================================== */

  const animacionActual =
    logroCompartiendo
      ? ANIMACIONES_LOGROS[
          logroCompartiendo.id
        ]
      : undefined;

  const shareModal =
    logroCompartiendo
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000010] flex items-center justify-center bg-gray-950/70 px-4 py-8 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievement-share-title"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                cerrarCompartir();
              }
            }}
          >
            <div
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {/* HEADER */}

              <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">
                    FinSightAI
                  </p>

                  <h2
                    id="achievement-share-title"
                    className="mt-1 text-xl font-bold text-gray-900 dark:text-white"
                  >
                    Compartí tu logro
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    cerrarCompartir
                  }
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
                >
                  ×
                </button>
              </div>

              {/* CONTENIDO */}

              <div className="p-6">

                {/* PREVIEW */}

                <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-6 text-center dark:border-brand-500/20 dark:from-brand-500/10 dark:via-gray-900 dark:to-blue-500/10">

                  <div
                    aria-hidden="true"
                    className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-500/10 blur-3xl"
                  />

                  <div
                    aria-hidden="true"
                    className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl"
                  />

                  <div className="relative z-10">

                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-500">
                      Logro desbloqueado
                    </p>

                    {/* FINSI ANIMADO */}

                    <div className="mx-auto mt-3 flex aspect-video w-full max-w-md items-center justify-center overflow-hidden">

                      {animacionActual ? (
                        <video
                          key={`${logroCompartiendo.id}-${animacionActual}`}
                          src={animacionActual}
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="auto"
                          controls={false}
                          className="h-full w-full object-contain"
                          onLoadedData={(event) => {
                            event.currentTarget.muted =
                              true;

                            void event.currentTarget
                              .play()
                              .catch(
                                () => undefined,
                              );
                          }}
                          onCanPlay={(event) => {
                            event.currentTarget.muted =
                              true;

                            void event.currentTarget
                              .play()
                              .catch(
                                () => undefined,
                              );
                          }}
                          onError={(event) => {
                            console.error(
                              'No se pudo cargar la animación del logro:',
                              logroCompartiendo.id,
                              animacionActual,
                              event,
                            );
                          }}
                        />
                      ) : logroCompartiendo.imagenUrl ? (
                        <img
                          src={
                            logroCompartiendo.imagenUrl
                          }
                          alt=""
                          className="h-24 w-24 object-contain"
                        />
                      ) : (
                        <span className="text-6xl">
                          {
                            logroCompartiendo.emoji
                          }
                        </span>
                      )}

                    </div>

                    <h3 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                      {
                        logroCompartiendo.titulo
                      }
                    </h3>

                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-400">
                      {
                        logroCompartiendo.descripcion
                      }
                    </p>

                    <p className="mt-5 text-xs font-semibold text-brand-500">
                      FinSightAI · Ver más allá de tus finanzas
                    </p>
                  </div>
                </div>

                {/* TEXTO */}

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
                  <p className="whitespace-pre-line text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {crearTextoCompartir(
                      logroCompartiendo,
                    )}
                  </p>
                </div>

                {/* COPIAR */}

                <button
                  type="button"
                  onClick={
                    copiarTexto
                  }
                  className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                >
                  {textoCopiado
                    ? '✓ Texto copiado'
                    : 'Copiar publicación'}
                </button>

                {/* REDES */}

                <p className="mb-3 mt-6 text-center text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
                  Compartir en
                </p>

                <div className="grid grid-cols-5 gap-2">

                  <button
                    type="button"
                    onClick={
                      compartirWhatsapp
                    }
                    title="WhatsApp"
                    aria-label="Compartir en WhatsApp"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-green-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-green-400"
                  >
                    <FaWhatsapp size={24} />

                    <span className="hidden text-[10px] font-medium sm:block">
                      WhatsApp
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={
                      compartirLinkedIn
                    }
                    title="Copiar texto y abrir LinkedIn"
                    aria-label="Copiar texto y abrir LinkedIn"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                  >
                    <FaLinkedinIn size={24} />

                    <span className="hidden text-[10px] font-medium sm:block">
                      LinkedIn
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={
                      compartirInstagram
                    }
                    title="Copiar texto y abrir Instagram"
                    aria-label="Copiar texto y abrir Instagram"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-pink-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-pink-400"
                  >
                    <FaInstagram size={24} />

                    <span className="hidden text-[10px] font-medium sm:block">
                      Instagram
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={
                      compartirFacebook
                    }
                    title="Copiar texto y abrir Facebook"
                    aria-label="Copiar texto y abrir Facebook"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                  >
                    <FaFacebookF size={24} />

                    <span className="hidden text-[10px] font-medium sm:block">
                      Facebook
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={
                      compartirX
                    }
                    title="X"
                    aria-label="Compartir en X"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                  >
                    <FaXTwitter size={24} />

                    <span className="hidden text-[10px] font-medium sm:block">
                      X
                    </span>
                  </button>

                </div>

                {/* AVISO */}

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center dark:border-gray-800 dark:bg-gray-950/50">
                  <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Importante:
                    </span>{' '}
                    WhatsApp y X completan la publicación automáticamente.
                    En LinkedIn, Facebook e Instagram copiamos el texto al
                    portapapeles para que puedas pegarlo al crear tu publicación.
                  </p>
                </div>

              </div>
            </div>
          </div>,

          document.body,
        )
      : null;

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">

        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Logros
          </h3>

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {desbloqueados.length}{' '}
            / {catalogo.length}
          </span>
        </div>

        <div className="space-y-6">

          {renderSeccion(
            'Logros especiales',
            'Easter eggs escondidos en el chat con el asistente.',
            'especial',
          )}

          {renderSeccion(
            'Hitos',
            'Logros por usar la app: crear metas, importar movimientos y mantener la constancia.',
            'hito',
          )}

        </div>
      </div>

      {shareModal}
    </>
  );
}