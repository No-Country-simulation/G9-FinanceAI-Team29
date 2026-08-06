import { useState } from 'react';
import Badge from '../ui/badge/Badge';
import type { TriviaQuestion } from '../../data/gamification';

interface TriviaQuizProps {
  canPlayToday: boolean;
  bestScore: number;
  correctStreak: number;
  buildRound: () => TriviaQuestion[];
  onFinish: (aciertos: number, total: number) => void;
}

type Fase = 'idle' | 'jugando' | 'resultado';

export default function TriviaQuiz({ canPlayToday, bestScore, correctStreak, buildRound, onFinish }: TriviaQuizProps) {
  const [fase, setFase] = useState<Fase>('idle');
  const [preguntas, setPreguntas] = useState<TriviaQuestion[]>([]);
  const [indice, setIndice] = useState(0);
  const [aciertos, setAciertos] = useState(0);
  const [seleccion, setSeleccion] = useState<number | null>(null);

  function empezar() {
    setPreguntas(buildRound());
    setIndice(0);
    setAciertos(0);
    setSeleccion(null);
    setFase('jugando');
  }

  function elegir(opcionIndex: number) {
    if (seleccion !== null) return;
    setSeleccion(opcionIndex);
    const correcta = opcionIndex === preguntas[indice].respuestaCorrecta;
    if (correcta) setAciertos((a) => a + 1);
  }

  function siguiente() {
    if (indice + 1 >= preguntas.length) {
      const total = preguntas.length;
      onFinish(aciertos, total);
      setFase('resultado');
      return;
    }
    setIndice((i) => i + 1);
    setSeleccion(null);
  }

  if (fase === 'idle') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trivia financiera</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Responde 5 preguntas sobre finanzas y sobre tus propios datos. Un intento por día.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Badge color="info" size="sm">Mejor puntaje: {bestScore}</Badge>
          <Badge color="warning" size="sm">Racha perfecta: {correctStreak}</Badge>
        </div>
        <button
          onClick={empezar}
          disabled={!canPlayToday}
          className="mt-5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {canPlayToday ? 'Jugar trivia de hoy' : 'Ya jugaste hoy, vuelve mañana'}
        </button>
      </div>
    );
  }

  if (fase === 'resultado') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">¡Ronda completa!</h3>
        <p className="mt-2 text-3xl font-semibold text-brand-500">{aciertos} / {preguntas.length}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Vuelve mañana para jugar de nuevo.</p>
      </div>
    );
  }

  const pregunta = preguntas[indice];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Pregunta {indice + 1} de {preguntas.length}</span>
        <span>Aciertos: {aciertos}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{pregunta.pregunta}</h3>
      <div className="mt-4 grid gap-2">
        {pregunta.opciones.map((opcion, i) => {
          const esCorrecta = i === pregunta.respuestaCorrecta;
          const esSeleccionada = i === seleccion;
          let estilo = 'border-gray-300 dark:border-gray-700 dark:text-white';
          if (seleccion !== null) {
            if (esCorrecta) estilo = 'border-success-500 bg-success-50 dark:bg-success-500/10 dark:text-white';
            else if (esSeleccionada) estilo = 'border-error-500 bg-error-50 dark:bg-error-500/10 dark:text-white';
          }
          return (
            <button
              key={i}
              onClick={() => elegir(i)}
              disabled={seleccion !== null}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm ${estilo}`}
            >
              {opcion}
            </button>
          );
        })}
      </div>
      {seleccion !== null && (
        <button onClick={siguiente} className="mt-5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white">
          {indice + 1 >= preguntas.length ? 'Ver resultado' : 'Siguiente pregunta'}
        </button>
      )}
    </div>
  );
}
