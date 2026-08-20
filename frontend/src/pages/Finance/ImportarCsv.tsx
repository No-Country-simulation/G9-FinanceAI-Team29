import { ChangeEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PageMeta from '../../components/common/PageMeta';
import { importarCsv, ImportacionCsvResponse, ModoImportacionCsv, obtenerTransacciones, obtenerUsuario } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';

type CelebracionPerfil = "riesgo" | "observacion" | "observacion-caida" | "saludable" | null;

function normalizarPerfil(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectarCelebracionPerfil(
  perfilAnterior: unknown,
  perfilNuevo: unknown,
): CelebracionPerfil {
  const anterior = normalizarPerfil(perfilAnterior);
  const nuevo = normalizarPerfil(perfilNuevo);

  // Si el perfil empeora hasta "En riesgo", mostramos una alerta audiovisual.
  // No es un logro ni un achievement: solo comunica un cambio importante.
  if (
    nuevo === "en riesgo" &&
    (anterior === "en observacion" || anterior === "saludable")
  ) {
    return "riesgo";
  }

  // Llegar a Saludable tiene prioridad absoluta. Si el usuario salta
  // directamente de En riesgo a Saludable, solo mostramos esta celebración.
  if (
    nuevo === "saludable" &&
    (anterior === "en observacion" || anterior === "en riesgo")
  ) {
    return "saludable";
  }

  if (anterior === "saludable" && nuevo === "en observacion") {
    return "observacion-caida";
  }

  if (anterior === "en riesgo" && nuevo === "en observacion") {
    return "observacion";
  }

  return null;
}

function CelebracionPerfilFullscreen({
  tipo,
  onFinish,
}: {
  tipo: Exclude<CelebracionPerfil, null>;
  onFinish: () => void;
}) {
  const [mostrarTexto, setMostrarTexto] = useState(false);
  const [faseRiesgo, setFaseRiesgo] = useState<0 | 1 | 2>(0);

  const esRiesgo = tipo === "riesgo";
  const esObservacionCaida = tipo === "observacion-caida";
  const esSaludable = tipo === "saludable";

  const videoSrc = esRiesgo
    ? "/images/task/finsi-thriller.mp4"
    : esObservacionCaida
      ? "/images/task/finsi-stumble.mp4"
      : esSaludable
        ? "/images/task/finsi-celebration.mp4"
        : "/images/task/finsi-moon.mp4";

  const contenido = (
    <div className="fixed inset-0 z-[99999] overflow-hidden bg-black">
      <video
        src={videoSrc}
        autoPlay
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        onTimeUpdate={(event) => {
          const video = event.currentTarget;

          if (!Number.isFinite(video.duration) || video.duration <= 0) {
            return;
          }

          const restante = video.duration - video.currentTime;

          if (esRiesgo) {
            // Sincronización exacta con finsi-thriller.mp4:
            // 0.00s–2.00s  → "Tus finanzas están muertas..."
            // 2.00s–2.40s  → pausa visual para el cambio de gag
            // 2.40s–final  → "¡Mentira!" + explicación de En riesgo
            if (video.currentTime < 2) {
              setFaseRiesgo(1);
            } else if (video.currentTime < 2.4) {
              setFaseRiesgo(0);
            } else {
              setFaseRiesgo(2);
            }
            return;
          }

          if (esObservacionCaida) {
            // El mensaje aparece desde el segundo 3 y permanece hasta el final,
            // para que haya tiempo suficiente de leerlo.
            if (video.currentTime >= 3) {
              setMostrarTexto(true);
            }
            return;
          }

          if (restante <= 2.8) {
            setMostrarTexto(true);
          }
        }}
        onEnded={onFinish}
        onError={onFinish}
      />

      {esRiesgo ? (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center px-4 pb-[8vh]">
          <div
            className={`max-w-4xl rounded-3xl border border-white/20 bg-black/55 px-7 py-5 text-center shadow-2xl backdrop-blur-md transition-all duration-500 sm:px-10 sm:py-7 ${
              faseRiesgo > 0
                ? "translate-y-0 opacity-100"
                : "translate-y-5 opacity-0"
            }`}
          >
            {faseRiesgo === 1 ? (
              <h2
                className="text-3xl font-black tracking-tight text-white sm:text-5xl"
                style={{
                  textShadow:
                    "-1px -1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9)",
                }}
              >
                Tus finanzas están muertas...
              </h2>
            ) : faseRiesgo === 2 ? (
              <>
                <h2
                  className="text-3xl font-black tracking-tight text-white sm:text-5xl"
                  style={{
                    textShadow:
                      "-1px -1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9)",
                  }}
                >
                  ¡Mentira!
                </h2>

                <p
                  className="mt-3 text-base font-semibold text-white sm:text-2xl"
                  style={{
                    textShadow:
                      "-1px -1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9)",
                  }}
                >
                  Tu perfil cambió a{" "}
                  <span className="font-black text-error-400">
                    En riesgo
                  </span>
                  . Es momento de tomar acciones concretas para recuperar el equilibrio.
                </p>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className={`pointer-events-none absolute inset-0 flex items-end justify-center px-4 pb-[8vh] transition-all duration-700 ${
            mostrarTexto
              ? "translate-y-0 opacity-100"
              : "translate-y-5 opacity-0"
          }`}
        >
          <div className="max-w-3xl rounded-3xl border border-white/20 bg-black/50 px-7 py-5 text-center shadow-2xl backdrop-blur-md sm:px-10 sm:py-7">
            <h2
              className="text-3xl font-black tracking-tight text-white sm:text-5xl"
              style={{
                textShadow:
                  "-1px -1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9)",
              }}
            >
              {esObservacionCaida
                ? "¡Hey! Un tropezón no es caída."
                : "¡Felicitaciones!"}
            </h2>

            <p
              className="mt-3 text-base font-semibold text-white sm:text-2xl"
              style={{
                textShadow:
                  "-1px -1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9), 1px 1px 0 rgba(0,0,0,.9)",
              }}
            >
              {esSaludable ? (
                <>
                  Alcanzaste un perfil financiero{" "}
                  <span className="font-black text-success-400">
                    Saludable
                  </span>
                  .
                </>
              ) : esObservacionCaida ? (
                <>
                  Pasaste a{" "}
                  <span className="font-black text-warning-400">
                    En observación
                  </span>
                  , pero con algunos ajustes en tus finanzas puedes recuperarte.
                </>
              ) : (
                <>
                  Tu perfil financiero mejoró a{" "}
                  <span className="font-black text-warning-400">
                    En observación
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(contenido, document.body);
}


function ConfirmacionSobreescribir({
  archivo,
  onCancelar,
  onConfirmar,
}: {
  archivo: File;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-sobreescribir"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-error-200 bg-white shadow-2xl dark:border-error-900/50 dark:bg-gray-900">
        <div className="flex flex-col items-center px-6 pb-5 pt-6 text-center sm:px-8">
          <img
            src="/images/mascot/finsight-bird-stop.png"
            alt="Finsi policía indicando detenerse"
            className="h-44 w-44 object-contain sm:h-52 sm:w-52"
          />

          <h2
            id="titulo-sobreescribir"
            className="mt-2 text-2xl font-black text-gray-900 dark:text-white"
          >
            ¡STOP! Revisá antes de continuar
          </h2>

          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Vas a <strong>sobreescribir movimientos existentes</strong>. FinSightAI
            reemplazará los movimientos del período comprendido por el CSV y conservará
            los datos que estén fuera de ese período.
          </p>

          <div className="mt-4 w-full rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-left text-sm text-error-700 dark:border-error-900/40 dark:bg-error-900/20 dark:text-error-300">
            <p className="font-semibold">Archivo seleccionado</p>
            <p className="mt-1 break-all">{archivo.name}</p>
            <p className="mt-2">
              Esta acción puede modificar tu historial, tus indicadores y tu perfil financiero.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:grid-cols-2 dark:border-gray-800 dark:bg-white/[0.03]">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="rounded-xl bg-error-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-error-600"
          >
            Sí, sobreescribir
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const MODOS_IMPORTACION: Array<{
  id: ModoImportacionCsv;
  titulo: string;
  descripcion: string;
  detalle: string;
}> = [
  {
    id: 'CARGAR',
    titulo: 'Cargar',
    descripcion: 'Primera importación',
    detalle: 'Usalo cuando todavía no tenés movimientos cargados.',
  },
  {
    id: 'ACTUALIZAR',
    titulo: 'Actualizar',
    descripcion: 'Agregar movimientos nuevos',
    detalle: 'Conserva tu historial y evita guardar duplicados.',
  },
  {
    id: 'SOBREESCRIBIR',
    titulo: 'Sobreescribir',
    descripcion: 'Corregir un período',
    detalle: 'Reemplaza los movimientos del período incluido en el CSV.',
  },
];

export default function ImportarCsv() {
  const { usuarioId } = useAuth();
  const { registrarEvento } = useGamification();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] =
    useState<ImportacionCsvResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebracionPerfil, setCelebracionPerfil] =
    useState<CelebracionPerfil>(null);
  const [modo, setModo] = useState<ModoImportacionCsv | null>(null);
  const [confirmarSobreescritura, setConfirmarSobreescritura] = useState(false);
  const [tieneMovimientos, setTieneMovimientos] = useState<boolean | null>(null);

  useEffect(() => {
    if (!usuarioId) {
      setTieneMovimientos(null);
      return;
    }

    let activo = true;

    const cargarEstadoMovimientos = async () => {
      try {
        const transacciones = await obtenerTransacciones(usuarioId);
        if (activo) {
          const hayMovimientos = transacciones.length > 0;
          setTieneMovimientos(hayMovimientos);
          setModo((modoActual) => {
            if (!hayMovimientos && modoActual !== 'CARGAR') return null;
            if (hayMovimientos && modoActual === 'CARGAR') return null;
            return modoActual;
          });
        }
      } catch (estadoError) {
        console.warn(
          'No se pudo determinar si el usuario tiene movimientos:',
          estadoError,
        );
        if (activo) {
          setTieneMovimientos(null);
        }
      }
    };

    void cargarEstadoMovimientos();

    return () => {
      activo = false;
    };
  }, [usuarioId]);

  const seleccionarArchivo = (event: ChangeEvent<HTMLInputElement>) => {
    const archivoSeleccionado = event.target.files?.[0] ?? null;

    setArchivo(archivoSeleccionado);
    setResultado(null);
    setError(null);
  };

  const ejecutarImportacion = async (modoSeleccionado: ModoImportacionCsv) => {
    if (!archivo) {
      setError('Seleccioná un archivo CSV antes de continuar.');
      return;
    }

    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      if (!usuarioId) {
        throw new Error(
          'La sesión no tiene un perfil financiero asociado. Cerrá sesión y volvé a ingresar.',
        );
      }

      // Guardamos el perfil anterior ANTES de importar. El trigger de
      // celebración solo depende del cambio causado por esta importación.
      let perfilAnterior: string | null = null;

      try {
        const perfilActual = await obtenerUsuario(usuarioId);
        perfilAnterior = perfilActual?.perfilFinanciero ?? null;
      } catch (perfilError) {
        console.warn(
          "No se pudo obtener el perfil anterior antes de importar el CSV:",
          perfilError,
        );
      }

      const data = await importarCsv(usuarioId, archivo, modoSeleccionado);

      if (!data) {
        throw new Error('El servidor devolvió una respuesta vacía.');
      }

      if (!data.resumen) {
        throw new Error(
          'El servidor no devolvió el resumen de la importación.'
        );
      }

      setResultado(data);
      setTieneMovimientos(true);
      registrarEvento('csv_importado');

      const celebracion = detectarCelebracionPerfil(
        perfilAnterior,
        data.perfilFinanciero,
      );

      if (celebracion) {
        setCelebracionPerfil(celebracion);
      }
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo importar el CSV.';

      setError(mensaje);
      setResultado(null);
    } finally {
      setCargando(false);
    }
  };

  const procesar = async () => {
    if (!archivo) {
      setError('Seleccioná un archivo CSV antes de continuar.');
      return;
    }

    if (!archivo.name.toLowerCase().endsWith('.csv')) {
      setError('El archivo seleccionado debe tener extensión .csv.');
      return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
      setError('El archivo supera el tamaño máximo permitido de 5 MB.');
      return;
    }

    if (!modo) {
      setError('Elegí si querés cargar, actualizar o sobreescribir los movimientos.');
      return;
    }

    if (tieneMovimientos === false && modo !== 'CARGAR') {
      setError('Primero realizá una carga inicial. Actualizar y Sobreescribir se habilitan cuando ya tenés movimientos.');
      return;
    }

    if (tieneMovimientos === true && modo === 'CARGAR') {
      setError('Ya tenés movimientos cargados. Usá Actualizar para agregar nuevos o Sobreescribir para corregir un período.');
      return;
    }

    if (modo === 'SOBREESCRIBIR') {
      setError(null);
      setConfirmarSobreescritura(true);
      return;
    }

    await ejecutarImportacion(modo);
  };

  const quitarArchivo = () => {
    setArchivo(null);
    setResultado(null);
    setError(null);
    setModo(null);
  };

  const formatearTamano = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatearNumero = (valor: unknown) => {
    if (typeof valor !== 'number' || Number.isNaN(valor)) {
      return '0';
    }

    return valor.toLocaleString('es-AR', {
      maximumFractionDigits: 2,
    });
  };

  return (
    <>
      <PageMeta
        title="Importar CSV | FinSightAI"
        description="Carga de movimientos financieros en dólares"
      />

      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Importar movimientos
          </h1>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Carga un CSV para actualizar tu perfil financiero. Todos los importes se procesan en
            dólares estadounidenses.
          </p>

          <div className="mt-4 flex max-w-3xl items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                Mantén tus movimientos actualizados
              </p>
              <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">
                Actualiza periódicamente tu CSV para que tu perfil financiero, análisis y
                recomendaciones reflejen tu situación más reciente.
              </p>
            </div>
          </div>
        </div>

        <div data-tour="page-import" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <input
              id="archivo-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={seleccionarArchivo}
              className="hidden"
            />

            <label
              htmlFor="archivo-csv"
              className="inline-flex cursor-pointer items-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Seleccionar CSV
            </label>

            {archivo ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-2.5 text-left dark:border-success-900/40 dark:bg-success-900/20">
                <div className="flex min-w-0 items-center gap-2.5">
                  <svg
                    className="h-5 w-5 shrink-0 text-success-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-success-700 dark:text-success-300">
                      {archivo.name}
                    </p>
                    <p className="text-xs text-success-600/80 dark:text-success-400/80">
                      {formatearTamano(archivo.size)} · listo para procesar
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={quitarArchivo}
                  aria-label="Quitar archivo"
                  className="shrink-0 rounded-md p-1 text-success-600 transition hover:bg-success-100 hover:text-success-800 dark:text-success-400 dark:hover:bg-success-900/40"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M18 6L6 18M6 6l12 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                Ningún archivo seleccionado
              </p>
            )}

            <p className="mt-3 text-xs text-gray-400">
              Tamaño máximo: 5 MB
            </p>
          </div>

          <div className="mt-5">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                ¿Qué querés hacer con este CSV?
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Elegí una opción antes de procesar el archivo.
              </p>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {MODOS_IMPORTACION.map((opcion) => {
                const seleccionado = modo === opcion.id;
                const esSobreescribir = opcion.id === 'SOBREESCRIBIR';
                const bloqueado =
                  tieneMovimientos === null ||
                  (tieneMovimientos === false && opcion.id !== 'CARGAR') ||
                  (tieneMovimientos === true && opcion.id === 'CARGAR');

                return (
                  <button
                    key={opcion.id}
                    type="button"
                    disabled={bloqueado}
                    onClick={() => {
                      setModo(opcion.id);
                      setError(null);
                      setResultado(null);
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      bloqueado
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50 dark:border-gray-800 dark:bg-white/[0.01]'
                        : seleccionado
                          ? esSobreescribir
                            ? 'border-error-400 bg-error-50 ring-2 ring-error-100 dark:border-error-500 dark:bg-error-900/20 dark:ring-error-900/30'
                            : 'border-brand-400 bg-brand-25 ring-2 ring-brand-100 dark:border-brand-500 dark:bg-brand-500/10 dark:ring-brand-500/20'
                          : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700 dark:hover:bg-white/[0.04]'
                    }`}
                    aria-pressed={seleccionado}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-bold ${
                          esSobreescribir
                            ? 'text-error-600 dark:text-error-400'
                            : 'text-gray-800 dark:text-white'
                        }`}
                      >
                        {opcion.titulo}
                      </span>

                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          seleccionado
                            ? esSobreescribir
                              ? 'border-error-500 bg-error-500'
                              : 'border-brand-500 bg-brand-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {seleccionado && (
                          <svg
                            viewBox="0 0 20 20"
                            className="h-3 w-3 text-white"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 10.5 8 14l8-9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {opcion.descripcion}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                      {bloqueado && tieneMovimientos === false
                        ? 'Disponible después de realizar tu primera carga.'
                        : bloqueado && tieneMovimientos === true && opcion.id === 'CARGAR'
                          ? 'Ya tenés movimientos cargados. Usá Actualizar o Sobreescribir.'
                          : opcion.detalle}
                    </p>
                  </button>
                );
              })}
            </div>

            {tieneMovimientos === false && (
              <p className="mt-3 text-xs font-medium text-brand-600 dark:text-brand-400">
                Esta es tu primera importación. Cargá tus movimientos antes de usar Actualizar o Sobreescribir.
              </p>
            )}

            {tieneMovimientos === true && (
              <p className="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                Ya tenés movimientos cargados. Usá Actualizar para agregar nuevos o Sobreescribir para corregir un período.
              </p>
            )}

            {modo === 'SOBREESCRIBIR' && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 dark:border-error-900/40 dark:bg-error-900/20">
                <img
                  src="/images/mascot/finsight-bird-stop.png"
                  alt=""
                  className="h-16 w-16 shrink-0 object-contain"
                  aria-hidden="true"
                />
                <p className="text-xs leading-5 text-error-700 dark:text-error-300">
                  <strong>Sobreescribir modifica datos existentes.</strong> Antes de continuar,
                  Finsi te va a pedir una confirmación final.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <p className="font-semibold">Columnas requeridas</p>

            <p className="mt-1 break-words font-mono text-xs">
              fecha, descripcion, monto, tipo, categoria, medio_pago,
              recurrente
            </p>

            <a
              href="/plantilla_movimientos_usuario.csv"
              download
              className="mt-3 inline-block font-medium text-brand-500 hover:text-brand-600"
            >
              Descargar plantilla de ejemplo
            </a>
          </div>

          {error && (
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-900/40 dark:bg-error-900/20 dark:text-error-300">
              <img src="/images/mascot/finsight-bird-import-error.png" alt="Finsi revisando el archivo" className="h-24 w-20 shrink-0 object-contain sm:h-28 sm:w-24" />
              <div><p className="font-semibold">Revisemos el archivo</p><p className="mt-1">{error}</p></div>
            </div>
          )}

          {cargando && (
            <div className="mt-5 flex items-center gap-4 rounded-xl border border-brand-100 bg-brand-25 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
              <img src="/images/mascot/finsight-bird-loading.png" alt="Finsi procesando la información" className="h-24 w-20 shrink-0 animate-pulse object-contain sm:h-28 sm:w-24" />
              <div><p className="font-semibold text-gray-800 dark:text-white">Finsi está procesando tus movimientos</p><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Puede tardar un momento. No cierres esta ventana.</p></div>
            </div>
          )}

          <button
            type="button"
            onClick={procesar}
            disabled={!archivo || !modo || cargando}
            className={`mt-6 w-full rounded-lg px-5 py-3 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              modo === 'SOBREESCRIBIR'
                ? 'bg-error-500 hover:bg-error-600'
                : 'bg-brand-500 hover:bg-brand-600'
            }`}
          >
            {cargando
              ? 'Procesando y guardando...'
              : modo === 'CARGAR'
                ? 'Cargar movimientos'
                : modo === 'ACTUALIZAR'
                  ? 'Actualizar movimientos'
                  : modo === 'SOBREESCRIBIR'
                    ? 'Sobreescribir período'
                    : 'Elegí una opción'}
          </button>
        </div>

        {resultado?.resumen && (
          <div className="rounded-2xl border border-success-200 bg-success-50 p-6 dark:border-success-900/40 dark:bg-success-900/20">
            <div className="flex items-center gap-4">
              <img src="/images/mascot/finsight-bird-import-success.png" alt="Finsi confirma la importación" className="h-28 w-24 shrink-0 object-contain sm:h-36 sm:w-32" />
              <div>
                <h2 className="text-lg font-semibold text-success-700 dark:text-success-300">
                  {resultado.mensaje || 'CSV procesado correctamente'}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Tus movimientos quedaron listos para usar en el dashboard y el asistente IA.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <Dato
                label="Movimientos"
                valor={resultado.resumen.cantidadTransacciones ?? 0}
              />

              <Dato
                label="Meses"
                valor={resultado.resumen.cantidadMeses ?? 0}
              />

              <Dato
                label="Ingresos"
                valor={`$${formatearNumero(
                  resultado.resumen.totalIngresos
                )}`}
              />

              <Dato
                label="Gastos"
                valor={`$${formatearNumero(
                  resultado.resumen.totalGastos
                )}`}
              />
            </div>

            {(resultado.movimientosInsertados !== undefined ||
              resultado.duplicadosIgnorados !== undefined ||
              resultado.movimientosReemplazados !== undefined) && (
              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-900/40">
                  <span className="text-gray-500">Insertados</span>
                  <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">
                    {resultado.movimientosInsertados ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-900/40">
                  <span className="text-gray-500">Duplicados ignorados</span>
                  <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">
                    {resultado.duplicadosIgnorados ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-900/40">
                  <span className="text-gray-500">Reemplazados</span>
                  <p className="mt-0.5 font-semibold text-gray-800 dark:text-white">
                    {resultado.movimientosReemplazados ?? 0}
                  </p>
                </div>
              </div>
            )}

            <div
              className={`mt-5 rounded-lg bg-white/70 p-4 text-sm font-semibold dark:bg-gray-900/40 ${
                normalizarPerfil(resultado.perfilFinanciero) === "saludable"
                  ? "text-success-400"
                  : normalizarPerfil(resultado.perfilFinanciero) === "en observacion"
                    ? "text-warning-400"
                    : normalizarPerfil(resultado.perfilFinanciero) === "en riesgo"
                      ? "text-error-400"
                      : "text-gray-900 dark:text-white"
              }`}
              style={{
                textShadow:
                  "-1px -1px 0 rgba(0,0,0,0.75), 1px -1px 0 rgba(0,0,0,0.75), -1px 1px 0 rgba(0,0,0,0.75), 1px 1px 0 rgba(0,0,0,0.75)",
              }}
            >
              Perfil calculado: {resultado.perfilFinanciero ?? 'Sin determinar'}
            </div>
          </div>
        )}
      </div>

      {confirmarSobreescritura && archivo && (
        <ConfirmacionSobreescribir
          archivo={archivo}
          onCancelar={() => setConfirmarSobreescritura(false)}
          onConfirmar={() => {
            setConfirmarSobreescritura(false);
            void ejecutarImportacion('SOBREESCRIBIR');
          }}
        />
      )}

      {celebracionPerfil && (
        <CelebracionPerfilFullscreen
          tipo={celebracionPerfil}
          onFinish={() => setCelebracionPerfil(null)}
        />
      )}
    </>
  );
}

function Dato({
  label,
  valor,
}: {
  label: string;
  valor: string | number;
}) {
  return (
    <div className="rounded-lg bg-white p-3 text-center shadow-sm dark:bg-gray-900/50">
      <p className="text-xs text-gray-500">{label}</p>

      <p className="mt-1 font-semibold text-gray-800 dark:text-white">
        {valor}
      </p>
    </div>
  );
}
