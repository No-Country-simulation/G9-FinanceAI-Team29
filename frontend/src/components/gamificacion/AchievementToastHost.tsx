import { useEffect } from 'react';
import { useGamification } from '../../context/GamificationContext';
import { playAchievementUnlock } from '../../utils/sound';

const DURACION_MS = 4000;

export default function AchievementToastHost() {
  const { celebracion, cerrarCelebracion } = useGamification();

  useEffect(() => {
    if (!celebracion) return;
    playAchievementUnlock();
    const timer = setTimeout(cerrarCelebracion, DURACION_MS);
    return () => clearTimeout(timer);
  }, [celebracion, cerrarCelebracion]);

  if (!celebracion) return null;

  return (
    <div
      key={celebracion.id}
      className="animate-achievement-toast fixed bottom-6 right-6 z-999999 flex w-[calc(100vw-3rem)] max-w-sm items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/95 p-4 shadow-theme-lg backdrop-blur"
      role="status"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-2xl">
        {celebracion.emoji}
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
