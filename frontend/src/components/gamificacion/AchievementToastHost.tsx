import { useEffect } from 'react';
import { useGamification } from '../../context/GamificationContext';
import { playAchievementUnlock, playAchievementDismiss } from '../../utils/sound';

const DURACION_MS = 4000;
// La animación CSS (achievement-toast) empieza a deslizarse hacia afuera en el
// 90% de su duración total: sincronizamos el sonido de salida con ese instante.
const INICIO_SALIDA_MS = DURACION_MS * 0.9;

export default function AchievementToastHost() {
  const { celebracion, cerrarCelebracion } = useGamification();

  useEffect(() => {
    if (!celebracion) return;
    playAchievementUnlock();
    const dismissTimer = setTimeout(playAchievementDismiss, INICIO_SALIDA_MS);
    const closeTimer = setTimeout(cerrarCelebracion, DURACION_MS);
    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(closeTimer);
    };
  }, [celebracion, cerrarCelebracion]);

  if (!celebracion) return null;

  return (
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
        <p className="truncate text-sm font-semibold text-white">{celebracion.titulo}</p>
        <p className="truncate text-xs text-gray-400">{celebracion.detalle}</p>
      </div>
    </div>
  );
}
