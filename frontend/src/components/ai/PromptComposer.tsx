import { useEffect, useRef, useState } from "react";
import { PaperPlaneIcon } from "../../icons";

interface PromptComposerProps {
  placeholder?: string;
  models?: string[];
  buttonLabel?: string;
  onSubmit: (prompt: string) => void;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function obtenerConstructorReconocimiento(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const NUM_BARRAS = 40;
const NIVEL_INACTIVO = Array(NUM_BARRAS).fill(3);

function MicrofonoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Barra de prompt inferior del Asistente IA. */
export default function PromptComposer({
  placeholder = "Escribe tu pregunta...",
  models = ["FinanceAI Advisor"],
  buttonLabel,
  onSubmit,
}: PromptComposerProps) {
  const [value, setValue] = useState("");
  const [model, setModel] = useState(models[0]);
  const [escuchando, setEscuchando] = useState(false);
  const [niveles, setNiveles] = useState<number[]>(NIVEL_INACTIVO);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const baseValueRef = useRef("");
  const finalTranscriptRef = useRef("");

  const soportaDictado = obtenerConstructorReconocimiento() !== null;

  const detenerDictado = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setEscuchando(false);
    setNiveles(NIVEL_INACTIVO);
  };

  useEffect(() => () => detenerDictado(), []);

  const iniciarDictado = async () => {
    const Ctor = obtenerConstructorReconocimiento();
    if (!Ctor) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const mitad = NUM_BARRAS / 2;

      const actualizarOndas = () => {
        analyser.getByteFrequencyData(dataArray);
        const grupoTam = Math.floor(dataArray.length / mitad) || 1;
        // Las frecuencias más fuertes suelen caer en los primeros bins;
        // se reflejan hacia ambos lados para que el pico quede al centro.
        const mitadNiveles = Array.from({ length: mitad }, (_, i) => {
          const inicio = i * grupoTam;
          let suma = 0;
          for (let j = inicio; j < inicio + grupoTam && j < dataArray.length; j++) {
            suma += dataArray[j];
          }
          const promedio = suma / grupoTam;
          return Math.max(4, Math.min(24, Math.round((promedio / 255) * 24)));
        });
        setNiveles([...mitadNiveles.slice().reverse(), ...mitadNiveles]);
        rafRef.current = requestAnimationFrame(actualizarOndas);
      };
      rafRef.current = requestAnimationFrame(actualizarOndas);
    } catch {
      return;
    }

    baseValueRef.current = value.trim();
    finalTranscriptRef.current = "";

    const recognition = new Ctor();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultado = event.results[i];
        if (resultado.isFinal) {
          finalTranscriptRef.current += `${resultado[0].transcript} `;
        } else {
          interim += resultado[0].transcript;
        }
      }
      const combinado = [baseValueRef.current, `${finalTranscriptRef.current}${interim}`.trim()]
        .filter(Boolean)
        .join(" ");
      setValue(combinado);
    };
    recognition.onerror = () => detenerDictado();
    recognition.onend = () => detenerDictado();

    recognitionRef.current = recognition;
    recognition.start();
    setEscuchando(true);
  };

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
        />
        {escuchando && (
          <div className="pointer-events-none absolute inset-0 flex items-center gap-[3px] rounded-lg bg-white px-3 dark:bg-gray-900">
            {niveles.map((nivel, i) => (
              <span
                key={i}
                className="flex-1 rounded-full bg-gray-400 transition-all duration-75 dark:bg-gray-500"
                style={{ height: `${nivel}px` }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-theme-xs font-medium text-gray-600 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {soportaDictado &&
            (escuchando ? (
              <button
                type="button"
                onClick={detenerDictado}
                title="Detener dictado"
                aria-label="Detener dictado"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-error-500 text-white transition hover:bg-error-600"
              >
                <span className="h-3 w-3 rounded-[2px] bg-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void iniciarDictado()}
                title="Dictar por voz"
                aria-label="Dictar por voz"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.06]"
              >
                <MicrofonoIcon className="size-4" />
              </button>
            ))}

          <button
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            {buttonLabel ?? "Enviar"}
            <PaperPlaneIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
