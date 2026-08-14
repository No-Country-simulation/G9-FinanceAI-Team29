import { useMemo, useRef, useState } from 'react';
import type { AchievementCategoria, AchievementDef, AchievementId } from '../../data/achievements';
import { LockIcon, LockOpenIcon } from '../../icons';

interface AchievementsListProps {
  catalogo: AchievementDef[];
  desbloqueados: AchievementId[];
  onPistaCompleta?: () => void;
}

/** Logros con easter eggs que ameritan un poco más de misterio en el candado. */
const ESPECIALES: AchievementId[] = ['rickroll', 'admin_click_frenzy', 'skynet'];

const CLICKS_PARA_REGANO = 3;
const CLICKS_PARA_PISTA = 6;
const DURACION_MENSAJE_MS = 2500;

const FRASES_REGANO = [
  '¿Qué haces? Así no vas a conseguir nada 😅',
  'Hacer clic sin parar no lo va a desbloquear, ¿sabes?',
  'Ese candado no se abre a base de clics...',
];

const RUNAS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'.split('');

/** Genera un texto de runas determinístico (mismo id -> mismo texto) al estilo "encantamiento". */
function textoMisterioso(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return seed
    .split(' ')
    .map((palabra) => {
      let out = '';
      for (let i = 0; i < Math.max(2, Math.min(palabra.length, 9)); i += 1) {
        h = (h * 1103515245 + 12345) >>> 0;
        out += RUNAS[h % RUNAS.length];
      }
      return out;
    })
    .join(' ');
}

export default function AchievementsList({ catalogo, desbloqueados, onPistaCompleta }: AchievementsListProps) {
  const [shakingId, setShakingId] = useState<AchievementId | null>(null);
  const [clicks, setClicks] = useState<Partial<Record<AchievementId, number>>>({});
  const [mensajeVisibleId, setMensajeVisibleId] = useState<AchievementId | null>(null);
  const ocultarMensajeTimeout = useRef<number | undefined>(undefined);

  const misteriosos = useMemo(() => {
    const mapa = new Map<AchievementId, string>();
    catalogo.forEach((logro) => mapa.set(logro.id, textoMisterioso(logro.id)));
    return mapa;
  }, [catalogo]);

  const reganos = useMemo(() => {
    const mapa = new Map<AchievementId, string>();
    catalogo.forEach((logro, i) => mapa.set(logro.id, FRASES_REGANO[i % FRASES_REGANO.length]));
    return mapa;
  }, [catalogo]);

  function handleClickBloqueado(id: AchievementId) {
    setShakingId(id);
    window.setTimeout(() => setShakingId((actual) => (actual === id ? null : actual)), 450);

    const nuevoConteo = (clicks[id] ?? 0) + 1;
    setClicks((actual) => ({ ...actual, [id]: nuevoConteo }));

    if (nuevoConteo === CLICKS_PARA_PISTA) {
      onPistaCompleta?.();
    }

    if (nuevoConteo >= CLICKS_PARA_REGANO) {
      setMensajeVisibleId(id);
      window.clearTimeout(ocultarMensajeTimeout.current);
      ocultarMensajeTimeout.current = window.setTimeout(() => {
        setMensajeVisibleId((actual) => (actual === id ? null : actual));
      }, DURACION_MENSAJE_MS);
    }
  }

  function renderGrid(items: AchievementDef[]) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((logro) => {
          const desbloqueado = desbloqueados.includes(logro.id);
          const especial = ESPECIALES.includes(logro.id);
          const clicksLogro = clicks[logro.id] ?? 0;
          const mensaje =
            desbloqueado || mensajeVisibleId !== logro.id
              ? null
              : clicksLogro >= CLICKS_PARA_PISTA
                ? `Pista: ${logro.pista}`
                : clicksLogro >= CLICKS_PARA_REGANO
                  ? reganos.get(logro.id)
                  : null;

          return (
            <button
              type="button"
              key={logro.id}
              title={desbloqueado ? logro.descripcion : '???'}
              onClick={desbloqueado ? undefined : () => handleClickBloqueado(logro.id)}
              className={`relative flex w-full flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                desbloqueado
                  ? 'cursor-default border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10'
                  : 'cursor-pointer border-gray-200 bg-gray-50 opacity-70 hover:opacity-90 dark:border-gray-800 dark:bg-white/[0.02]'
              } ${!desbloqueado && especial ? 'animate-achievement-locked-special-glow' : ''} ${
                shakingId === logro.id ? 'animate-achievement-locked-shake' : ''
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
                      logro.id === 'equipo_descubierto' ? 'h-20 w-20' : 'h-12 w-12'
                    }`}
                  />
                ) : (
                  <span className="text-2xl">{logro.emoji}</span>
                )
              ) : (
                <LockIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  desbloqueado
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'tracking-wide text-gray-400 select-none dark:text-gray-600'
                }`}
              >
                {desbloqueado ? logro.titulo : misteriosos.get(logro.id)}
              </span>
              {mensaje && (
                <span className="text-xs font-medium leading-snug text-red-500 dark:text-red-400">
                  {mensaje}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  function renderSeccion(titulo: string, subtitulo: string, categoria: AchievementCategoria) {
    const items = catalogo.filter((logro) => logro.categoria === categoria);
    if (items.length === 0) return null;
    const desbloqueadosCount = items.filter((logro) => desbloqueados.includes(logro.id)).length;

    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{titulo}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitulo}</p>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {desbloqueadosCount} / {items.length}
          </span>
        </div>
        {renderGrid(items)}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Logros</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {desbloqueados.length} / {catalogo.length}
        </span>
      </div>
      <div className="space-y-6">
        {renderSeccion('Logros especiales', 'Easter eggs escondidos en el chat con el asistente.', 'especial')}
        {renderSeccion('Hitos', 'Logros por usar la app: crear metas, importar movimientos y mantener la constancia.', 'hito')}
      </div>
    </div>
  );
}
