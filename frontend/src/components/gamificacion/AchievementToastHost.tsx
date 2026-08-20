import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGamification } from '../../context/GamificationContext';
import { playAchievementUnlock, playAchievementDismiss } from '../../utils/sound';

const DURACION_MS = 4000;
// La animación CSS (achievement-toast) empieza a deslizarse hacia afuera en el
// 90% de su duración total: sincronizamos el sonido de salida con ese instante.
const INICIO_SALIDA_MS = DURACION_MS * 0.9;
const ESPERA_ANTES_SPLASH_MS = 800;
const EASTER_EGG_PLAYBACK_EVENT = 'finsight:easter-egg-playback';
const PROFILE_SPLASH_PLAYBACK_EVENT = 'finsight:profile-splash-playback';

type SplashKind = 'indy' | 'champion';

type SplashToast = {
  id: string;
  emoji: string;
  emojiImg?: string;
  titulo: string;
  detalle: string;
};

const SPLASH_CONFIG: Record<
  SplashKind,
  { video: string; poster: string; titulo: string; detalle: string }
> = {
  indy: {
    video: '/images/task/finsi-indy.mp4',
    poster: '/images/task/finsi-indy-poster.webp',
    titulo: 'Eres un Coleccionista de Secretos',
    detalle: 'Descubriste todos los secretos ocultos de Finsi.',
  },
  champion: {
    video: '/images/task/finsi-champion.mp4',
    poster: '/images/task/finsi-champion-poster.webp',
    titulo: 'Eres una Leyenda de las Finanzas',
    detalle: 'Completaste todos los hitos de FinSightAI.',
  },
};

function splashParaCelebracion(id: string): SplashKind | null {
  if (id.startsWith('logro-coleccionista_secretos-')) return 'indy';
  if (id.startsWith('logro-leyenda_finanzas-')) return 'champion';
  return null;
}

export default function AchievementToastHost() {
  const { celebracion, cerrarCelebracion } = useGamification();
  const [easterEggsActivos, setEasterEggsActivos] = useState<Set<number>>(() => new Set());
  const [splashesPendientes, setSplashesPendientes] = useState<SplashKind[]>([]);
  const [splashActiva, setSplashActiva] = useState<SplashKind | null>(null);
  const [videoTerminado, setVideoTerminado] = useState(false);
  const [profileSplashActiva, setProfileSplashActiva] = useState(false);
  const [splashToast, setSplashToast] = useState<SplashToast | null>(null);
  const [splashToastVisible, setSplashToastVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const hayEasterEggActivo = easterEggsActivos.size > 0;
  const configSplash = useMemo(
    () => (splashActiva ? SPLASH_CONFIG[splashActiva] : null),
    [splashActiva],
  );

  useEffect(() => {
    const handlePlayback = (event: Event) => {
      const detail = (event as CustomEvent<{ messageId: number; active: boolean }>).detail;
      if (!detail || typeof detail.messageId !== 'number') return;

      setEasterEggsActivos((actuales) => {
        const siguientes = new Set(actuales);
        if (detail.active) siguientes.add(detail.messageId);
        else siguientes.delete(detail.messageId);
        return siguientes;
      });
    };

    window.addEventListener(EASTER_EGG_PLAYBACK_EVENT, handlePlayback);
    return () => window.removeEventListener(EASTER_EGG_PLAYBACK_EVENT, handlePlayback);
  }, []);

  useEffect(() => {
    const handleProfileSplashPlayback = (event: Event) => {
      const detail = (event as CustomEvent<{ active: boolean }>).detail;
      if (!detail || typeof detail.active !== 'boolean') return;

      setProfileSplashActiva(detail.active);
    };

    window.addEventListener(
      PROFILE_SPLASH_PLAYBACK_EVENT,
      handleProfileSplashPlayback,
    );

    return () =>
      window.removeEventListener(
        PROFILE_SPLASH_PLAYBACK_EVENT,
        handleProfileSplashPlayback,
      );
  }, []);

  useEffect(() => {
    // Los toasts normales pueden mostrarse encima de videos de Easter Egg
    // y de celebraciones fullscreen de perfil. Solo esperamos si ya hay una
    // splash final de Indy/Champion activa.
    if (!celebracion || splashActiva) return;

    const splash = splashParaCelebracion(celebracion.id);

    // Los dos logros finales usan su propia splash como celebración.
    // No muestran un toast separado antes del video.
    if (splash) {
      setSplashToast({
        id: celebracion.id,
        emoji: celebracion.emoji,
        emojiImg: celebracion.emojiImg,
        titulo: celebracion.titulo,
        detalle: celebracion.detalle,
      });

      setSplashesPendientes((actuales) =>
        actuales.includes(splash) ? actuales : [...actuales, splash],
      );

      cerrarCelebracion();
      return;
    }

    // Para todos los achievements/niveles normales conservamos exactamente
    // el comportamiento del host anterior.
    playAchievementUnlock();

    const dismissTimer = window.setTimeout(
      playAchievementDismiss,
      INICIO_SALIDA_MS,
    );

    const closeTimer = window.setTimeout(() => {
      cerrarCelebracion();
    }, DURACION_MS);

    return () => {
      window.clearTimeout(dismissTimer);
      window.clearTimeout(closeTimer);
    };
  }, [
    celebracion,
    cerrarCelebracion,
    splashActiva,
  ]);

  useEffect(() => {
    // La splash solo aparece cuando no queda ningún video del chat ni toast pendiente.
    if (
      splashActiva ||
      celebracion ||
      hayEasterEggActivo ||
      profileSplashActiva ||
      splashesPendientes.length === 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSplashesPendientes((actuales) => {
        const [siguiente, ...resto] = actuales;

        if (siguiente) {
          setVideoTerminado(false);
          setSplashActiva(siguiente);
        }

        return resto;
      });
    }, ESPERA_ANTES_SPLASH_MS);

    return () => window.clearTimeout(timer);
  }, [
    celebracion,
    hayEasterEggActivo,
    profileSplashActiva,
    splashActiva,
    splashesPendientes,
  ]);

  useEffect(() => {
    if (!splashActiva || !splashToast) return;

    setSplashToastVisible(true);
    playAchievementUnlock();

    const dismissTimer = window.setTimeout(
      playAchievementDismiss,
      INICIO_SALIDA_MS,
    );

    const hideTimer = window.setTimeout(() => {
      setSplashToastVisible(false);
    }, DURACION_MS);

    return () => {
      window.clearTimeout(dismissTimer);
      window.clearTimeout(hideTimer);
    };
  }, [splashActiva, splashToast]);

  useEffect(() => {
    if (!splashActiva) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, [splashActiva]);

  const manejarFinVideo = () => {
    // Dejamos el elemento <video> montado y pausado para conservar visualmente
    // su último frame. El poster sigue siendo respaldo de carga.
    videoRef.current?.pause();
    setVideoTerminado(true);
  };

  const splash =
    splashActiva && configSplash
      ? createPortal(
          <div
            className="fixed inset-0 z-[1000001] flex items-center justify-center overflow-hidden bg-black"
            role="dialog"
            aria-modal="true"
            aria-label={configSplash.titulo}
          >
            <video
              ref={videoRef}
              key={splashActiva}
              src={configSplash.video}
              poster={configSplash.poster}
              autoPlay
              muted={false}
              playsInline
              preload="auto"
              onLoadedMetadata={(event) => {
                event.currentTarget.muted = false;
                event.currentTarget.volume = 1;
              }}
              onPlay={(event) => {
                event.currentTarget.muted = false;
                event.currentTarget.volume = 1;
              }}
              onEnded={manejarFinVideo}
              onError={() => setVideoTerminado(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {splashToast && splashToastVisible && (
              <div
                key={splashToast.id}
                className="animate-achievement-toast fixed inset-x-3 top-20 z-[1000002] flex w-[calc(100vw-1.5rem)] max-w-sm items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-theme-lg backdrop-blur lg:inset-x-auto lg:top-auto lg:bottom-6 lg:right-6 lg:w-[calc(100vw-3rem)]"
                role="status"
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-2xl">
                  {splashToast.emojiImg ? (
                    <img
                      src={splashToast.emojiImg}
                      alt=""
                      className={`rounded-sm object-contain ${
                        splashToast.emojiImg.includes('unmask.gif')
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
                    Logro desbloqueado
                  </p>

                  <p className="truncate text-sm font-semibold text-white">
                    {splashToast.titulo}
                  </p>

                  <p className="truncate text-xs text-gray-400">
                    {splashToast.detalle}
                  </p>
                </div>
              </div>
            )}

            {videoTerminado && (
              <>
                <img
                  src={configSplash.poster}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/10" />

                <div className="absolute inset-x-4 bottom-8 z-10 mx-auto max-w-3xl text-center sm:bottom-12">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-400 sm:text-sm">
                    Logro desbloqueado
                  </p>

                  <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-amber-300 sm:text-base">
                    ¡Felicitaciones!
                  </p>

                  <h2 className="mt-3 text-3xl font-extrabold text-white drop-shadow-lg sm:text-5xl">
                    {configSplash.titulo}
                  </h2>

                  <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-200 sm:text-lg">
                    {configSplash.detalle}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSplashActiva(null);
                      setSplashToastVisible(false);
                      setSplashToast(null);
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

  return (
    <>
      {celebracion &&
        !splashActiva &&
        !splashParaCelebracion(celebracion.id) && (
        <div
          key={celebracion.id}
          className="animate-achievement-toast fixed inset-x-3 top-20 z-999999 flex w-[calc(100vw-1.5rem)] max-w-sm items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-theme-lg backdrop-blur lg:inset-x-auto lg:top-auto lg:bottom-6 lg:right-6 lg:w-[calc(100vw-3rem)]"
          role="status"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-2xl">
            {celebracion.emojiImg ? (
              <img
                src={celebracion.emojiImg}
                alt=""
                className={`rounded-sm object-contain ${
                  celebracion.emojiImg.includes('unmask.gif') ? 'h-16 w-16' : 'h-14 w-14'
                }`}
              />
            ) : (
              celebracion.emoji
            )}
          </span>

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-400">
              {celebracion.tipo === 'logro' ? 'Logro desbloqueado' : '¡Subiste de nivel!'}
            </p>

            <p className="truncate text-sm font-semibold text-white">
              {celebracion.titulo}
            </p>

            <p className="truncate text-xs text-gray-400">
              {celebracion.detalle}
            </p>
          </div>
        </div>
      )}

      {splash}
    </>
  );
}
