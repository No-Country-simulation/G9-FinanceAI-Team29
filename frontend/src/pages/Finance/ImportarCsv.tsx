import { ChangeEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import PageMeta from '../../components/common/PageMeta';
import { importarCsv, ImportacionCsvResponse, obtenerUsuario } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';

type CelebracionPerfil = "riesgo" | "observacion" | "saludable" | null;

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
  const esSaludable = tipo === "saludable";

  const videoSrc = esRiesgo
    ? "/images/task/finsi-thriller.mp4"
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
              ¡Felicitaciones!
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

  const seleccionarArchivo = (event: ChangeEvent<HTMLInputElement>) => {
    const archivoSeleccionado = event.target.files?.[0] ?? null;

    setArchivo(archivoSeleccionado);
    setResultado(null);
    setError(null);
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
      // celebración solo depende de una mejora causada por esta carga CSV.
      let perfilAnterior: string | null = null;

      try {
        const perfilActual = await obtenerUsuario(usuarioId);
        perfilAnterior = perfilActual?.perfilFinanciero ?? null;
      } catch (perfilError) {
        // Si por algún motivo no podemos leer el estado anterior, permitimos
        // igualmente la importación pero evitamos disparar una celebración falsa.
        console.warn(
          "No se pudo obtener el perfil anterior antes de importar el CSV:",
          perfilError,
        );
      }

      const data = await importarCsv(usuarioId, archivo);

      if (!data) {
        throw new Error('El servidor devolvió una respuesta vacía.');
      }

      if (!data.resumen) {
        throw new Error(
          'El servidor no devolvió el resumen de la importación.'
        );
      }

      setResultado(data);
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

            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              {archivo ? archivo.name : 'Ningún archivo seleccionado'}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Tamaño máximo: 5 MB
            </p>
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
            disabled={!archivo || cargando}
            className="mt-6 w-full rounded-lg bg-brand-500 px-5 py-3 font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? 'Procesando y guardando...' : 'Procesar CSV'}
          </button>
        </div>

        {resultado?.resumen && (
          <div className="rounded-2xl border border-success-200 bg-success-50 p-6 dark:border-success-900/40 dark:bg-success-900/20">
            <div className="flex items-center gap-4">
              <img src="/images/mascot/finsight-bird-import-success.png" alt="Finsi confirma la importación" className="h-28 w-24 shrink-0 object-contain sm:h-36 sm:w-32" />
              <div><h2 className="text-lg font-semibold text-success-700 dark:text-success-300">CSV importado correctamente</h2>

              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Tus movimientos quedaron listos para usar en el dashboard y el asistente IA.</p></div>
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
