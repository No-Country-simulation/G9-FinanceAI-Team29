import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { TrophyIcon, FlameIcon } from './StatIcons';
import { TEMAS_RULETA, type TriviaQuestion, type TriviaTema } from '../../data/gamification';
import {
  playTriviaStart,
  playWheelTick,
  playWheelStop,
  playTriviaCorrect,
  playTriviaWrong,
  playTriviaFinishPerfecto,
  playTriviaFinishBien,
  playTriviaFinishPractica,
} from '../../utils/sound';

export interface TriviaRespuesta {
  preguntaId: string;
  correcta: boolean;
}

interface TriviaQuizProps {
  canPlayToday: boolean;
  bestScore: number;
  correctStreak: number;
  buildRound: () => TriviaQuestion[];
  onFinish: (aciertos: number, total: number, respuestas: TriviaRespuesta[]) => void;
}

type Fase = 'idle' | 'jugando' | 'resultado';

const CONFETTI_EMOJI = ['🎉', '✨', '⭐', '💥', '🏆', '💛'];

const FRASES_MASCOTA_IZQUIERDA = [
  '¿Sabías que ahorrar un poco cada día suma mucho?',
  '¡Vamos a poner a prueba tus finanzas!',
  'Pensando... ¿estás list@ para el reto de hoy?',
  'Cada pregunta te acerca a ser un experto en finanzas.',
];

const FRASES_MASCOTA_DERECHA = [
  '¡Entra y no pierdas tu racha!',
  'Hoy puedes sumar puntos a tu mejor puntaje.',
  '¡Te espero para jugar!',
  'Un intento diario, ¡no lo dejes pasar!',
];

type NivelResultado = 'perfecto' | 'bien' | 'practica';

const FRASES_RESULTADO: Record<NivelResultado, string[]> = {
  perfecto: [
    '¡Eres un genio de las finanzas!',
    '¡Racha perfecta, impresionante!',
    'Con este nivel, hasta yo aprendo de ti.',
    '¡Ni una sola pregunta te ganó!',
  ],
  bien: [
    '¡Vas muy bien, sigue así!',
    'Un poco más y la sacas perfecta.',
    'Se nota que practicas tus finanzas.',
    '¡Nada mal! Mañana la mejoramos.',
  ],
  practica: [
    'No te preocupes, mañana tienes otra oportunidad.',
    'Cada intento suma experiencia.',
    'Repasemos juntos algunos conceptos.',
    '¡Ánimo! La práctica hace al maestro.',
  ],
};

function BurbujaMascota({ texto, className = '' }: { texto: string; className?: string }) {
  return (
    <div
      className={`relative mb-3 max-w-[10rem] rounded-2xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium leading-snug text-brand-700 shadow-theme-xs dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 ${className}`}
    >
      {texto}
      <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10" />
    </div>
  );
}

const SEGMENTOS_RULETA = [
  '#465fff',
  '#f59e0b',
  '#12b76a',
  '#f04438',
  '#7a5af8',
  '#06aed4',
];

const TEMA_ICONOS: Record<TriviaTema, string> = {
  Ahorro: '🐷',
  Presupuesto: '📊',
  Deudas: '💳',
  Interés: '📈',
  Inversión: '🚀',
  Gastos: '🛍️',
  Metas: '🎯',
  Perfil: '🧠',
};

interface RuletaTriviaProps {
  girando?: boolean;
  tema?: TriviaTema | null;
  size?: 'lg' | 'md';
}

/** Ruleta de categorías al estilo "Preguntados": gira lento en reposo, rápido
 * mientras sortea, y aterriza mostrando el ícono + nombre del tema real. */
function RuletaTrivia({ girando = false, tema = null, size = 'lg' }: RuletaTriviaProps) {
  const gradiente = useMemo(() => {
    const paso = 360 / SEGMENTOS_RULETA.length;
    const stops = SEGMENTOS_RULETA.map(
      (color, i) => `${color} ${i * paso}deg ${(i + 1) * paso}deg`,
    );
    return `conic-gradient(${stops.join(', ')})`;
  }, []);

  const wheelDims = size === 'lg' ? 'h-28 w-28 xl:h-32 xl:w-32' : 'h-16 w-16 xl:h-[4.5rem] xl:w-[4.5rem]';
  const hubDims = size === 'lg' ? 'h-11 w-11 text-xl xl:h-12 xl:w-12' : 'h-8 w-8 text-sm xl:h-9 xl:w-9';
  const pointerBorder =
    size === 'lg'
      ? 'border-x-[10px] border-x-transparent border-t-[14px]'
      : 'border-x-[7px] border-x-transparent border-t-[10px]';

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative mx-auto flex items-center justify-center transition-transform duration-300 ${wheelDims} ${
          girando ? 'scale-110' : ''
        }`}
      >
        <span
          className={`absolute -top-1.5 z-10 h-0 w-0 border-t-gray-700 drop-shadow-sm dark:border-t-gray-100 ${pointerBorder}`}
          aria-hidden="true"
        />
        <span
          className="h-full w-full animate-spin rounded-full shadow-theme-md ring-4 ring-white dark:ring-gray-900"
          style={{ background: gradiente, animationDuration: girando ? '0.5s' : '7s' }}
          aria-hidden="true"
        />
        <span
          className={`absolute flex items-center justify-center rounded-full border-2 border-white bg-brand-500 font-bold text-white shadow-theme-xs dark:border-gray-900 ${hubDims}`}
        >
          <span key={tema ?? '?'} className="animate-trivia-category-cycle inline-block">
            {tema ? TEMA_ICONOS[tema] : '?'}
          </span>
        </span>
      </div>
      <div className="mt-2 h-5">
        {tema && (
          <span
            key={tema}
            className="animate-trivia-category-cycle inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
          >
            {tema}
          </span>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  const particulas = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 250,
        dx: (Math.random() - 0.5) * 140,
        rot: Math.random() * 320 - 160,
        emoji: CONFETTI_EMOJI[i % CONFETTI_EMOJI.length],
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particulas.map((p) => (
        <span
          key={p.id}
          className="animate-quiz-confetti absolute top-0 text-lg"
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}ms`,
              '--quiz-confetti-x': `${p.dx}px`,
              '--quiz-confetti-rot': `${p.rot}deg`,
            } as CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function ScoreRing({ aciertos, total }: { aciertos: number; total: number }) {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setListo(true), 50);
    return () => clearTimeout(t);
  }, []);

  const pct = total > 0 ? aciertos / total : 0;
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  const offset = circunferencia * (1 - (listo ? pct : 0));
  const color = pct === 1 ? '#7c3aed' : pct >= 0.6 ? '#22c55e' : '#f59e0b';

  return (
    <svg viewBox="0 0 100 100" className="animate-quiz-ring-in h-28 w-28 -rotate-90">
      <circle cx="50" cy="50" r={radio} fill="none" strokeWidth="8" className="stroke-gray-100 dark:stroke-gray-800" />
      <circle
        cx="50"
        cy="50"
        r={radio}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={circunferencia}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </svg>
  );
}

export default function TriviaQuiz({ canPlayToday, bestScore, correctStreak, buildRound, onFinish }: TriviaQuizProps) {
  const [fase, setFase] = useState<Fase>('idle');
  const [preguntas, setPreguntas] = useState<TriviaQuestion[]>([]);
  const [indice, setIndice] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [respuestas, setRespuestas] = useState<TriviaRespuesta[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; key: number } | null>(null);
  const [displayedScore, setDisplayedScore] = useState(0);
  const [girando, setGirando] = useState(false);
  const [categoriaSorteada, setCategoriaSorteada] = useState<TriviaTema | null>(null);
  const [fraseResultadoIzq, setFraseResultadoIzq] = useState('');
  const [fraseResultadoDer, setFraseResultadoDer] = useState('');
  const fraseIzquierda = useMemo(
    () => FRASES_MASCOTA_IZQUIERDA[Math.floor(Math.random() * FRASES_MASCOTA_IZQUIERDA.length)],
    [],
  );
  const fraseDerecha = useMemo(
    () => FRASES_MASCOTA_DERECHA[Math.floor(Math.random() * FRASES_MASCOTA_DERECHA.length)],
    [],
  );

  useEffect(() => {
    if (fase !== 'resultado') return;
    setDisplayedScore(0);
    if (aciertos === 0) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplayedScore(i);
      if (i >= aciertos) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [fase, aciertos]);

  useEffect(() => {
    if (fase !== 'resultado') return;
    const total = preguntas.length;
    const pct = total > 0 ? aciertos / total : 0;
    const nivel: NivelResultado = pct === 1 ? 'perfecto' : pct >= 0.6 ? 'bien' : 'practica';
    const barajadas = [...FRASES_RESULTADO[nivel]].sort(() => 0.5 - Math.random());
    setFraseResultadoIzq(barajadas[0]);
    setFraseResultadoDer(barajadas[1] ?? barajadas[0]);

    if (nivel === 'perfecto') playTriviaFinishPerfecto();
    else if (nivel === 'bien') playTriviaFinishBien();
    else playTriviaFinishPractica();
  }, [fase, aciertos, preguntas.length]);

  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinTimeout2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (spinTimeout2Ref.current) clearTimeout(spinTimeout2Ref.current);
    },
    [],
  );

  /** Hace girar la ruleta hasta aterrizar en `temaFinal` y recién entonces
   * ejecuta `alAterrizar`. Se usa tanto para arrancar la trivia como para
   * pasar de una pregunta a la siguiente, siempre de forma imperativa (nunca
   * como reacción a un cambio de estado) para que solo gire una vez por vez. */
  function girarHasta(temaFinal: TriviaTema, alAterrizar: () => void) {
    const otrosTemas = TEMAS_RULETA.filter((t) => t !== temaFinal);
    setGirando(true);
    let i = 0;
    spinIntervalRef.current = setInterval(() => {
      setCategoriaSorteada(otrosTemas[i % otrosTemas.length]);
      playWheelTick();
      i += 1;
    }, 110);
    spinTimeoutRef.current = setTimeout(() => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      setCategoriaSorteada(temaFinal);
      playWheelStop();
      spinTimeout2Ref.current = setTimeout(() => {
        setGirando(false);
        alAterrizar();
      }, 500);
    }, 1100);
  }

  function jugarConAnimacion() {
    if (!canPlayToday || girando) return;
    const ronda = buildRound();
    const temaFinal: TriviaTema = ronda[0]?.tema ?? TEMAS_RULETA[0];

    playTriviaStart();
    girarHasta(temaFinal, () => {
      setPreguntas(ronda);
      setIndice(0);
      setAciertos(0);
      setRespuestas([]);
      setSeleccion(null);
      setFeedback(null);
      setFase('jugando');
    });
  }

  function elegir(opcionIndex: number) {
    if (seleccion !== null) return;
    setSeleccion(opcionIndex);
    const correcta = opcionIndex === preguntas[indice].respuestaCorrecta;
    if (correcta) {
      setAciertos((a) => a + 1);
      playTriviaCorrect();
    } else {
      playTriviaWrong();
    }
    setFeedback({ ok: correcta, key: Date.now() });
    setRespuestas((r) => [...r, { preguntaId: preguntas[indice].id, correcta }]);
  }

  function siguiente() {
    if (girando) return;
    if (indice + 1 >= preguntas.length) {
      onFinish(aciertos, preguntas.length, respuestas);
      setFase('resultado');
      return;
    }
    const siguienteIndice = indice + 1;
    const temaFinal = preguntas[siguienteIndice].tema;
    setSeleccion(null);
    setFeedback(null);
    girarHasta(temaFinal, () => {
      setIndice(siguienteIndice);
    });
  }

  if (fase === 'resultado') {
    const total = preguntas.length;
    const pct = total > 0 ? aciertos / total : 0;
    const perfecto = pct === 1;
    const mensaje = perfecto ? '¡Puntaje perfecto!' : pct >= 0.6 ? '¡Muy bien hecho!' : 'Sigue practicando';
    const emoji = perfecto ? '🏆' : pct >= 0.6 ? '🎉' : '💪';

    return (
      <div className="relative flex h-full min-h-[26rem] flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-white/[0.03] sm:p-8 lg:min-h-[32rem]">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-warning-400/20 blur-3xl" />
        {perfecto && <Confetti />}

        <div className="relative flex items-end justify-center gap-1 sm:gap-3">
          <div className="hidden flex-col items-center lg:flex">
            <BurbujaMascota texto={fraseResultadoIzq} />
            <div className="relative flex items-center justify-center">
              <span className="absolute h-16 w-16 rounded-full bg-brand-400/25 blur-2xl xl:h-20 xl:w-20" />
              <img
                src="/images/mascot/mascot-thinking.png"
                alt=""
                aria-hidden="true"
                className="animate-welcome-float pointer-events-none relative h-20 w-20 object-contain drop-shadow-xl xl:h-24 xl:w-24"
                style={{ animationDuration: '5s' }}
              />
            </div>
          </div>

          <div>
            <span className="animate-quiz-fade-slide-in inline-block text-4xl">{emoji}</span>
            <h3 className="animate-quiz-fade-slide-in mt-2 text-lg font-semibold text-gray-900 dark:text-white">
              {mensaje}
            </h3>
            <div className="relative mx-auto mt-4 flex h-28 w-28 items-center justify-center">
              <ScoreRing aciertos={aciertos} total={total} />
              <span className="absolute text-2xl font-bold text-gray-900 dark:text-white">
                {displayedScore}/{total}
              </span>
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Vuelve mañana para jugar de nuevo.</p>
            <button
              onClick={() => setFase('idle')}
              className="mt-5 rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Volver
            </button>
          </div>

          <div className="hidden flex-col items-center lg:flex">
            <BurbujaMascota texto={fraseResultadoDer} />
            <div className="relative flex items-center justify-center">
              <span className="absolute h-16 w-16 rounded-full bg-warning-400/25 blur-2xl xl:h-20 xl:w-20" />
              <img
                src="/images/mascot/finsight-bird-auth-lean-light-compact.png"
                alt=""
                aria-hidden="true"
                className="animate-welcome-float pointer-events-none relative h-20 w-20 object-contain drop-shadow-xl xl:h-24 xl:w-24"
                style={{ animationDuration: '4.3s', animationDelay: '0.6s' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // idle y jugando comparten el mismo contenedor para que la ruleta nunca se
  // desmonte entre fases: así puede "deslizarse" de un lugar a otro con
  // transiciones CSS en vez de reaparecer de golpe.
  const enJuego = fase === 'jugando';
  const pregunta = enJuego ? preguntas[indice] : undefined;
  const progresoPct =
    enJuego && pregunta ? ((indice + (seleccion !== null ? 1 : 0)) / preguntas.length) * 100 : 0;
  const mostrarPregunta = enJuego && !girando && !!pregunta;

  return (
    <div className="relative flex h-full min-h-[26rem] flex-col items-center gap-4 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-center dark:border-gray-800 dark:bg-white/[0.03] sm:p-8 lg:min-h-[32rem]">
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-warning-400/20 blur-3xl" />

      {/* Fila de la ruleta: siempre queda anclada arriba, con margen fijo, para
          que el contenido variable de abajo nunca la reposicione. */}
      <div
        className={`relative mt-2 flex shrink-0 items-end justify-center gap-1 transition-transform duration-500 ease-out sm:gap-3 ${
          enJuego ? '-translate-y-1' : ''
        }`}
      >
        {!enJuego && (
          <div className="hidden flex-col items-center lg:flex">
            <BurbujaMascota texto={fraseIzquierda} />
            <div className="relative flex items-center justify-center">
              <span className="absolute h-16 w-16 rounded-full bg-brand-400/25 blur-2xl xl:h-20 xl:w-20" />
              <img
                src="/images/mascot/mascot-thinking.png"
                alt=""
                aria-hidden="true"
                className="animate-welcome-float pointer-events-none relative h-20 w-20 object-contain drop-shadow-xl xl:h-24 xl:w-24"
                style={{ animationDuration: '5s' }}
              />
            </div>
          </div>
        )}

        <RuletaTrivia girando={girando} tema={categoriaSorteada} />

        {!enJuego && (
          <div className="hidden flex-col items-center lg:flex">
            <BurbujaMascota texto={fraseDerecha} />
            <div className="relative flex items-center justify-center">
              <span className="absolute h-16 w-16 rounded-full bg-warning-400/25 blur-2xl xl:h-20 xl:w-20" />
              <img
                src="/images/mascot/finsight-bird-auth-lean-light-compact.png"
                alt=""
                aria-hidden="true"
                className="animate-welcome-float pointer-events-none relative h-20 w-20 object-contain drop-shadow-xl xl:h-24 xl:w-24"
                style={{ animationDuration: '4.3s', animationDelay: '0.6s' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Contenido variable: crece o se achica sin desplazar la ruleta de arriba. */}
      <div className="flex w-full flex-1 flex-col items-center justify-center">
      {!enJuego && (
        <div
          className={`relative max-w-md transition-opacity duration-300 ${
            girando ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trivia financiera</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Responde 5 preguntas sobre finanzas y sobre tus propios datos. Un intento por día.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-1 pr-3 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-500 dark:bg-gray-900">
                <TrophyIcon className="h-3 w-3" />
              </span>
              Mejor puntaje: {bestScore}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 py-1 pl-1 pr-3 text-xs font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-warning-500 dark:bg-gray-900">
                <FlameIcon className="h-3 w-3" />
              </span>
              Racha perfecta: {correctStreak}
            </span>
          </div>
          <button
            onClick={jugarConAnimacion}
            disabled={!canPlayToday || girando}
            className="mt-6 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white shadow-theme-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {girando ? 'Girando la ruleta…' : canPlayToday ? 'Jugar trivia de hoy' : 'Ya jugaste hoy, vuelve mañana'}
          </button>
        </div>
      )}

      {enJuego && !mostrarPregunta && (
        <p className="animate-quiz-fade-slide-in text-sm font-medium text-gray-500 dark:text-gray-400">
          Sorteando la categoría de tu pregunta…
        </p>
      )}

      {mostrarPregunta && pregunta && (
        <div className="w-full text-left">
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Pregunta {indice + 1} de {preguntas.length}</span>
              <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                {aciertos > 0 && <FlameIcon className="h-3.5 w-3.5 text-error-500" />} Aciertos: {aciertos}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
                style={{ width: `${progresoPct}%` }}
              />
            </div>
          </div>

          <div key={indice} className="animate-quiz-fade-slide-in">
            <h3 className="relative pr-2 text-lg font-semibold text-gray-900 dark:text-white">
              {pregunta.pregunta}
              {feedback && (
                <span
                  key={feedback.key}
                  className={`animate-quiz-feedback-pop pointer-events-none absolute -top-1 right-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                    feedback.ok
                      ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400'
                      : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400'
                  }`}
                >
                  {feedback.ok ? '¡Correcto! +1' : 'Incorrecto'}
                </span>
              )}
            </h3>
            <div className="mt-4 grid gap-2">
              {pregunta.opciones.map((opcion, i) => {
                const esCorrecta = i === pregunta.respuestaCorrecta;
                const esSeleccionada = i === seleccion;
                let estilo =
                  'border-gray-300 text-gray-700 hover:border-brand-300 hover:bg-brand-50/50 dark:border-gray-700 dark:text-white dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5';
                let anim = '';
                if (seleccion !== null) {
                  if (esCorrecta) {
                    estilo = 'border-success-500 bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300';
                    anim = 'animate-quiz-correct-pop';
                  } else if (esSeleccionada) {
                    estilo = 'border-error-500 bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300';
                    anim = 'animate-quiz-shake';
                  } else {
                    estilo = 'border-gray-200 text-gray-400 opacity-60 dark:border-gray-800 dark:text-gray-500';
                  }
                }
                return (
                  <button
                    key={i}
                    onClick={() => elegir(i)}
                    disabled={seleccion !== null}
                    style={{ animationDelay: seleccion === null ? `${i * 60}ms` : undefined }}
                    className={`animate-quiz-option-in flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors duration-200 disabled:cursor-default ${estilo} ${anim}`}
                  >
                    <span>{opcion}</span>
                    {seleccion !== null && esCorrecta && <span className="text-success-500">✓</span>}
                    {seleccion !== null && esSeleccionada && !esCorrecta && <span className="text-error-500">✕</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {seleccion !== null && (
            <button
              onClick={siguiente}
              className="animate-quiz-fade-slide-in mt-5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg"
            >
              {indice + 1 >= preguntas.length ? 'Ver resultado' : 'Siguiente pregunta'}
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
