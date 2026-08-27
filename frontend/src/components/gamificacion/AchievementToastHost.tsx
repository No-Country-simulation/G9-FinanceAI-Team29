import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaWhatsapp,
  FaXTwitter,
} from 'react-icons/fa6';

import { useGamification } from '../../context/GamificationContext';

import {
  playAchievementDismiss,
  playAchievementUnlock,
} from '../../utils/sound';

/* ============================================================
   CONFIGURACIÓN GENERAL
   ============================================================ */

const DURACION_MS = 4000;

const INICIO_SALIDA_MS =
  DURACION_MS * 0.9;

const ESPERA_ANTES_SPLASH_MS = 800;

const EASTER_EGG_PLAYBACK_EVENT =
  'finsight:easter-egg-playback';

const PROFILE_SPLASH_PLAYBACK_EVENT =
  'finsight:profile-splash-playback';

/* ============================================================
   LOGROS COMPARTIBLES
   ============================================================ */

const LOGROS_COMPARTIBLES = [
  'matrix',
  'got',
  'abrazo',
] as const;

type LogroCompartibleId =
  (typeof LOGROS_COMPARTIBLES)[number];

function obtenerLogroCompartible(
  celebracionId: string,
): LogroCompartibleId | null {
  for (
    const logroId
    of LOGROS_COMPARTIBLES
  ) {
    if (
      celebracionId === logroId ||
      celebracionId.startsWith(
        `logro-${logroId}-`,
      )
    ) {
      return logroId;
    }
  }

  return null;
}

/* ============================================================
   SHARE
   ============================================================ */

type ShareAchievement = {
  id: LogroCompartibleId;
  titulo: string;
  detalle: string;
  emoji: string;
  emojiImg?: string;
};

function crearTextoCompartir(
  achievement: ShareAchievement,
): string {
  return `Usé FinSightAI y desbloqueé el logro "${achievement.titulo}" 🎉

${achievement.detalle}

Un paso más para seguir entendiendo mejor mis finanzas.

#FinSightAI #FinanzasPersonales`;
}

function obtenerUrlCompartir(): string {
  return window.location.origin;
}

function abrirVentanaCompartir(
  url: string,
): void {
  window.open(
    url,
    '_blank',
    'noopener,noreferrer,width=720,height=650',
  );
}

/* ============================================================
   SPLASHES
   ============================================================ */

type SplashKind =
  | 'indy'
  | 'champion';

type SplashToast = {
  id: string;
  emoji: string;
  emojiImg?: string;
  titulo: string;
  detalle: string;
};

const SPLASH_CONFIG: Record<
  SplashKind,
  {
    video: string;
    poster: string;
    titulo: string;
    detalle: string;
  }
> = {
  indy: {
    video:
      '/images/task/finsi-indy.mp4',

    poster:
      '/images/task/finsi-indy-poster.webp',

    titulo:
      'Eres un Coleccionista de Secretos',

    detalle:
      'Descubriste todos los secretos ocultos de Finsi.',
  },

  champion: {
    video:
      '/images/task/finsi-champion.mp4',

    poster:
      '/images/task/finsi-champion-poster.webp',

    titulo:
      'Eres una Leyenda de las Finanzas',

    detalle:
      'Completaste todos los hitos de FinSightAI.',
  },
};

function splashParaCelebracion(
  id: string,
): SplashKind | null {
  if (
    id.startsWith(
      'logro-coleccionista_secretos-',
    )
  ) {
    return 'indy';
  }

  if (
    id.startsWith(
      'logro-leyenda_finanzas-',
    )
  ) {
    return 'champion';
  }

  return null;
}

/* ============================================================
   COMPONENTE
   ============================================================ */

export default function AchievementToastHost() {
  const {
    celebracion,
    cerrarCelebracion,
  } = useGamification();

  /* ==========================================================
     ESTADOS ORIGINALES
     ========================================================== */

  const [
    easterEggsActivos,
    setEasterEggsActivos,
  ] = useState<Set<number>>(
    () => new Set(),
  );

  const [
    splashesPendientes,
    setSplashesPendientes,
  ] = useState<SplashKind[]>([]);

  const [
    splashActiva,
    setSplashActiva,
  ] =
    useState<SplashKind | null>(
      null,
    );

  const [
    videoTerminado,
    setVideoTerminado,
  ] = useState(false);

  const [
    profileSplashActiva,
    setProfileSplashActiva,
  ] = useState(false);

  const [
    splashToast,
    setSplashToast,
  ] =
    useState<SplashToast | null>(
      null,
    );

  const [
    splashToastVisible,
    setSplashToastVisible,
  ] = useState(false);

  /* ==========================================================
     SHARE
     ========================================================== */

  const [
    shareAchievement,
    setShareAchievement,
  ] =
    useState<ShareAchievement | null>(
      null,
    );

  const [
    textoCopiado,
    setTextoCopiado,
  ] = useState(false);

  /* ==========================================================
     VIDEO
     ========================================================== */

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const hayEasterEggActivo =
    easterEggsActivos.size > 0;

  const configSplash = useMemo(
    () =>
      splashActiva
        ? SPLASH_CONFIG[
            splashActiva
          ]
        : null,

    [splashActiva],
  );

  /* ==========================================================
     EVENTO EASTER EGG
     ========================================================== */

  useEffect(() => {
    const handlePlayback = (
      event: Event,
    ) => {
      const detail = (
        event as CustomEvent<{
          messageId: number;
          active: boolean;
        }>
      ).detail;

      if (
        !detail ||
        typeof detail.messageId !==
          'number'
      ) {
        return;
      }

      setEasterEggsActivos(
        (actuales) => {
          const siguientes =
            new Set(actuales);

          if (detail.active) {
            siguientes.add(
              detail.messageId,
            );
          } else {
            siguientes.delete(
              detail.messageId,
            );
          }

          return siguientes;
        },
      );
    };

    window.addEventListener(
      EASTER_EGG_PLAYBACK_EVENT,
      handlePlayback,
    );

    return () => {
      window.removeEventListener(
        EASTER_EGG_PLAYBACK_EVENT,
        handlePlayback,
      );
    };
  }, []);

  /* ==========================================================
     EVENTO PROFILE SPLASH
     ========================================================== */

  useEffect(() => {
    const handleProfileSplashPlayback =
      (event: Event) => {
        const detail = (
          event as CustomEvent<{
            active: boolean;
          }>
        ).detail;

        if (
          !detail ||
          typeof detail.active !==
            'boolean'
        ) {
          return;
        }

        setProfileSplashActiva(
          detail.active,
        );
      };

    window.addEventListener(
      PROFILE_SPLASH_PLAYBACK_EVENT,
      handleProfileSplashPlayback,
    );

    return () => {
      window.removeEventListener(
        PROFILE_SPLASH_PLAYBACK_EVENT,
        handleProfileSplashPlayback,
      );
    };
  }, []);

  /* ==========================================================
     CELEBRACIONES
     ========================================================== */

  useEffect(() => {
    if (
      !celebracion ||
      splashActiva
    ) {
      return;
    }

    const splash =
      splashParaCelebracion(
        celebracion.id,
      );

    if (splash) {
      setSplashToast({
        id: celebracion.id,

        emoji:
          celebracion.emoji,

        emojiImg:
          celebracion.emojiImg,

        titulo:
          celebracion.titulo,

        detalle:
          celebracion.detalle,
      });

      setSplashesPendientes(
        (actuales) =>
          actuales.includes(
            splash,
          )
            ? actuales
            : [
                ...actuales,
                splash,
              ],
      );

      cerrarCelebracion();

      return;
    }

    playAchievementUnlock();

    const dismissTimer =
      window.setTimeout(
        playAchievementDismiss,
        INICIO_SALIDA_MS,
      );

    const closeTimer =
      window.setTimeout(
        () => {
          cerrarCelebracion();
        },
        DURACION_MS,
      );

    return () => {
      window.clearTimeout(
        dismissTimer,
      );

      window.clearTimeout(
        closeTimer,
      );
    };
  }, [
    celebracion,
    cerrarCelebracion,
    splashActiva,
  ]);

  /* ==========================================================
     COLA DE SPLASHES
     ========================================================== */

  useEffect(() => {
    if (
      splashActiva ||
      celebracion ||
      hayEasterEggActivo ||
      profileSplashActiva ||
      splashesPendientes.length ===
        0
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setSplashesPendientes(
            (actuales) => {
              const [
                siguiente,
                ...resto
              ] = actuales;

              if (siguiente) {
                setVideoTerminado(
                  false,
                );

                setSplashActiva(
                  siguiente,
                );
              }

              return resto;
            },
          );
        },

        ESPERA_ANTES_SPLASH_MS,
      );

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    celebracion,
    hayEasterEggActivo,
    profileSplashActiva,
    splashActiva,
    splashesPendientes,
  ]);

  /* ==========================================================
     TOAST DE SPLASH
     ========================================================== */

  useEffect(() => {
    if (
      !splashActiva ||
      !splashToast
    ) {
      return;
    }

    setSplashToastVisible(true);

    playAchievementUnlock();

    const dismissTimer =
      window.setTimeout(
        playAchievementDismiss,
        INICIO_SALIDA_MS,
      );

    const hideTimer =
      window.setTimeout(
        () => {
          setSplashToastVisible(
            false,
          );
        },

        DURACION_MS,
      );

    return () => {
      window.clearTimeout(
        dismissTimer,
      );

      window.clearTimeout(
        hideTimer,
      );
    };
  }, [
    splashActiva,
    splashToast,
  ]);

  /* ==========================================================
     BLOQUEAR SCROLL SPLASH
     ========================================================== */

  useEffect(() => {
    if (!splashActiva) {
      return;
    }

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.body.style.overflow =
        overflowAnterior;
    };
  }, [splashActiva]);

  /* ==========================================================
     BLOQUEAR SCROLL SHARE
     ========================================================== */

  useEffect(() => {
    if (!shareAchievement) {
      return;
    }

    const overflowAnterior =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    return () => {
      document.body.style.overflow =
        overflowAnterior;
    };
  }, [shareAchievement]);

  /* ==========================================================
     FIN DEL VIDEO
     ========================================================== */

  const manejarFinVideo = () => {
    videoRef.current?.pause();

    setVideoTerminado(true);
  };

  /* ==========================================================
     ABRIR SHARE
     ========================================================== */

  const abrirCompartirLogro =
    () => {
      if (
        !celebracion ||
        celebracion.tipo !==
          'logro'
      ) {
        return;
      }

      const logroId =
        obtenerLogroCompartible(
          celebracion.id,
        );

      if (!logroId) {
        return;
      }

      setShareAchievement({
        id: logroId,

        titulo:
          celebracion.titulo,

        detalle:
          celebracion.detalle,

        emoji:
          celebracion.emoji,

        emojiImg:
          celebracion.emojiImg,
      });

      setTextoCopiado(false);
    };

  /* ==========================================================
     CERRAR SHARE
     ========================================================== */

  const cerrarCompartirLogro =
    () => {
      setShareAchievement(null);

      setTextoCopiado(false);
    };

  /* ==========================================================
     COPIAR TEXTO
     ========================================================== */

  const copiarTexto =
    async () => {
      if (!shareAchievement) {
        return;
      }

      const texto =
        crearTextoCompartir(
          shareAchievement,
        );

      try {
        await navigator.clipboard.writeText(
          texto,
        );

        setTextoCopiado(true);

        window.setTimeout(
          () => {
            setTextoCopiado(
              false,
            );
          },

          2000,
        );
      } catch (error) {
        console.error(
          'No se pudo copiar la publicación:',
          error,
        );
      }
    };

  /* ==========================================================
     WHATSAPP
     ========================================================== */

  const compartirWhatsapp =
    () => {
      if (!shareAchievement) {
        return;
      }

      const texto =
        crearTextoCompartir(
          shareAchievement,
        );

      const url =
        obtenerUrlCompartir();

      abrirVentanaCompartir(
        `https://wa.me/?text=${encodeURIComponent(
          `${texto}\n\n${url}`,
        )}`,
      );
    };

  /* ==========================================================
     LINKEDIN
     ========================================================== */

  const compartirLinkedIn =
    async () => {
      if (!shareAchievement) {
        return;
      }

      await copiarTexto();

      const url =
        obtenerUrlCompartir();

      abrirVentanaCompartir(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          url,
        )}`,
      );
    };

  /* ==========================================================
     FACEBOOK
     ========================================================== */

  const compartirFacebook =
    () => {
      const url =
        obtenerUrlCompartir();

      abrirVentanaCompartir(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          url,
        )}`,
      );
    };

  /* ==========================================================
     X
     ========================================================== */

  const compartirX = () => {
    if (!shareAchievement) {
      return;
    }

    const texto =
      crearTextoCompartir(
        shareAchievement,
      );

    const url =
      obtenerUrlCompartir();

    abrirVentanaCompartir(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        texto,
      )}&url=${encodeURIComponent(
        url,
      )}`,
    );
  };

  /* ==========================================================
     INSTAGRAM
     ========================================================== */

  const compartirInstagram =
    async () => {
      await copiarTexto();

      window.open(
        'https://www.instagram.com/',
        '_blank',
        'noopener,noreferrer',
      );
    };

  /* ==========================================================
     SPLASH
     ========================================================== */

  const splash =
    splashActiva &&
    configSplash
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000001] flex items-center justify-center overflow-hidden bg-black"
            role="dialog"
            aria-modal="true"
            aria-label={
              configSplash.titulo
            }
          >
            <video
              ref={videoRef}
              key={splashActiva}
              src={
                configSplash.video
              }
              poster={
                configSplash.poster
              }
              autoPlay
              muted={false}
              playsInline
              preload="auto"
              onLoadedMetadata={(
                event,
              ) => {
                event.currentTarget.muted =
                  false;

                event.currentTarget.volume =
                  1;
              }}
              onPlay={(
                event,
              ) => {
                event.currentTarget.muted =
                  false;

                event.currentTarget.volume =
                  1;
              }}
              onEnded={
                manejarFinVideo
              }
              onError={() => {
                setVideoTerminado(
                  true,
                );
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {splashToast &&
              splashToastVisible && (
                <div
                  key={
                    splashToast.id
                  }
                  className="animate-achievement-toast fixed inset-x-3 top-20 z-[1000002] flex w-[calc(100vw-1.5rem)] max-w-sm items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-theme-lg backdrop-blur lg:inset-x-auto lg:top-auto lg:bottom-6 lg:right-6 lg:w-[calc(100vw-3rem)]"
                  role="status"
                >
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-2xl">
                    {splashToast.emojiImg ? (
                      <img
                        src={
                          splashToast.emojiImg
                        }
                        alt=""
                        className={`rounded-sm object-contain ${
                          splashToast.emojiImg.includes(
                            'unmask.gif',
                          )
                            ? 'h-16 w-16'
                            : 'h-14 w-14'
                        }`}
                      />
                    ) : (
                      splashToast.emoji
                    )}
                  </span>

                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-400">
                      Logro
                      desbloqueado
                    </p>

                    <p className="truncate text-sm font-semibold text-white">
                      {
                        splashToast.titulo
                      }
                    </p>

                    <p className="truncate text-xs text-gray-400">
                      {
                        splashToast.detalle
                      }
                    </p>
                  </div>
                </div>
              )}

            {videoTerminado && (
              <>
                <img
                  src={
                    configSplash.poster
                  }
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/10" />

                <div className="absolute inset-x-4 bottom-8 z-10 mx-auto max-w-3xl text-center sm:bottom-12">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-400 sm:text-sm">
                    Logro
                    desbloqueado
                  </p>

                  <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-amber-300 sm:text-base">
                    ¡Felicitaciones!
                  </p>

                  <h2 className="mt-3 text-3xl font-extrabold text-white drop-shadow-lg sm:text-5xl">
                    {
                      configSplash.titulo
                    }
                  </h2>

                  <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-200 sm:text-lg">
                    {
                      configSplash.detalle
                    }
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSplashActiva(
                        null,
                      );

                      setSplashToastVisible(
                        false,
                      );

                      setSplashToast(
                        null,
                      );
                    }}
                    className="mt-6 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-theme-md transition hover:bg-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}
          </div>,

          document.body,
        )
      : null;

  /* ==========================================================
     MODAL SHARE
     ========================================================== */

  const shareModal =
    shareAchievement
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000010] flex items-center justify-center bg-gray-950/70 px-4 py-8 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-achievement-title"
            onMouseDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                cerrarCompartirLogro();
              }
            }}
          >
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">

              {/* HEADER */}

              <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">
                    FinSightAI
                  </p>

                  <h2
                    id="share-achievement-title"
                    className="mt-1 text-xl font-bold text-gray-900 dark:text-white"
                  >
                    Compartí tu logro
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    cerrarCompartirLogro
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
                      Logro
                      desbloqueado
                    </p>

                    <div className="mx-auto mt-5 flex h-28 w-28 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900/80 dark:ring-gray-800">

                      {shareAchievement.emojiImg ? (
                        <img
                          src={
                            shareAchievement.emojiImg
                          }
                          alt=""
                          className="h-24 w-24 object-contain"
                        />
                      ) : (
                        <span className="text-6xl">
                          {
                            shareAchievement.emoji
                          }
                        </span>
                      )}

                    </div>

                    <h3 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
                      {
                        shareAchievement.titulo
                      }
                    </h3>

                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-400">
                      {
                        shareAchievement.detalle
                      }
                    </p>

                    <p className="mt-5 text-xs font-semibold text-brand-500">
                      FinSightAI · Ver más
                      allá de tus finanzas
                    </p>

                  </div>
                </div>

                {/* TEXTO */}

                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
                  <p className="whitespace-pre-line text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {crearTextoCompartir(
                      shareAchievement,
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

                  {/* WHATSAPP */}

                  <button
                    type="button"
                    onClick={
                      compartirWhatsapp
                    }
                    title="WhatsApp"
                    aria-label="Compartir en WhatsApp"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-green-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-green-400"
                  >
                    <FaWhatsapp
                      size={24}
                    />

                    <span className="hidden text-[10px] font-medium sm:block">
                      WhatsApp
                    </span>
                  </button>

                  {/* LINKEDIN */}

                  <button
                    type="button"
                    onClick={
                      compartirLinkedIn
                    }
                    title="LinkedIn"
                    aria-label="Compartir en LinkedIn"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                  >
                    <FaLinkedinIn
                      size={24}
                    />

                    <span className="hidden text-[10px] font-medium sm:block">
                      LinkedIn
                    </span>
                  </button>

                  {/* INSTAGRAM */}

                  <button
                    type="button"
                    onClick={
                      compartirInstagram
                    }
                    title="Instagram"
                    aria-label="Compartir en Instagram"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-pink-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-pink-400"
                  >
                    <FaInstagram
                      size={24}
                    />

                    <span className="hidden text-[10px] font-medium sm:block">
                      Instagram
                    </span>
                  </button>

                  {/* FACEBOOK */}

                  <button
                    type="button"
                    onClick={
                      compartirFacebook
                    }
                    title="Facebook"
                    aria-label="Compartir en Facebook"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                  >
                    <FaFacebookF
                      size={24}
                    />

                    <span className="hidden text-[10px] font-medium sm:block">
                      Facebook
                    </span>
                  </button>

                  {/* X */}

                  <button
                    type="button"
                    onClick={
                      compartirX
                    }
                    title="X"
                    aria-label="Compartir en X"
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-gray-500 transition hover:bg-gray-50 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                  >
                    <FaXTwitter
                      size={24}
                    />

                    <span className="hidden text-[10px] font-medium sm:block">
                      X
                    </span>
                  </button>

                </div>

                <p className="mt-4 text-center text-[11px] leading-5 text-gray-400 dark:text-gray-500">
                  En Instagram se copia
                  automáticamente la
                  publicación y se abre
                  Instagram para que
                  puedas pegarla.
                </p>

              </div>
            </div>
          </div>,

          document.body,
        )
      : null;

  /* ==========================================================
     LOGRO ACTUAL COMPARTIBLE
     ========================================================== */

  const logroCompartibleActual =
    celebracion &&
    celebracion.tipo === 'logro'
      ? obtenerLogroCompartible(
          celebracion.id,
        )
      : null;

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <>
      {/* ======================================================
          TOAST NORMAL
          ====================================================== */}

      {celebracion &&
        !splashActiva &&
        !splashParaCelebracion(
          celebracion.id,
        ) && (
          <div
            key={
              celebracion.id
            }
            className="animate-achievement-toast fixed inset-x-3 top-20 z-999999 flex w-[calc(100vw-1.5rem)] max-w-sm items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-theme-lg backdrop-blur lg:inset-x-auto lg:top-auto lg:bottom-6 lg:right-6 lg:w-[calc(100vw-3rem)]"
            role="status"
          >

            {/* IMAGEN */}

            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-2xl">

              {celebracion.emojiImg ? (
                <img
                  src={
                    celebracion.emojiImg
                  }
                  alt=""
                  className={`rounded-sm object-contain ${
                    celebracion.emojiImg.includes(
                      'unmask.gif',
                    )
                      ? 'h-16 w-16'
                      : 'h-14 w-14'
                  }`}
                />
              ) : (
                celebracion.emoji
              )}

            </span>

            {/* TEXTO */}

            <div className="min-w-0 flex-1">

              <p className="text-xs font-bold uppercase tracking-wide text-brand-400">
                {celebracion.tipo ===
                'logro'
                  ? 'Logro desbloqueado'
                  : '¡Subiste de nivel!'}
              </p>

              <p className="truncate text-sm font-semibold text-white">
                {
                  celebracion.titulo
                }
              </p>

              <p className="truncate text-xs text-gray-400">
                {
                  celebracion.detalle
                }
              </p>

            </div>

            {/* ==================================================
                COMPARTIR
                ================================================== */}

            {logroCompartibleActual && (
              <button
                type="button"
                onClick={
                  abrirCompartirLogro
                }
                title="Compartir logro"
                aria-label="Compartir logro"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-400/30 bg-brand-500/10 text-brand-300 transition hover:border-brand-400/50 hover:bg-brand-500/20 hover:text-white"
              >
                <svg
                  width="17"
                  height="17"
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
              </button>
            )}

          </div>
        )}

      {/* SPLASH */}

      {splash}

      {/* MODAL SHARE */}

      {shareModal}
    </>
  );
}