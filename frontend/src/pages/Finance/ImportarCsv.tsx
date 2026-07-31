import { ChangeEvent, useState } from 'react';
import PageMeta from '../../components/common/PageMeta';
import { importarCsv, ImportacionCsvResponse } from '../../services/api';

const USUARIO_DEMO = 'USR1001';

export default function ImportarCsv() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] =
    useState<ImportacionCsvResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const data = await importarCsv(USUARIO_DEMO, archivo);

      if (!data) {
        throw new Error('El servidor devolvió una respuesta vacía.');
      }

      if (!data.resumen) {
        throw new Error(
          'El servidor no devolvió el resumen de la importación.'
        );
      }

      setResultado(data);
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
        title="FinSightAI | Importar CSV"
        description="Carga de movimientos financieros en dólares"
      />

      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Importar movimientos
          </h1>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Cargá un CSV para crear el perfil financiero de{' '}
            <strong>{USUARIO_DEMO}</strong>. Todos los importes se procesan en
            dólares estadounidenses.
          </p>
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
            <div className="mt-5 rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-900/40 dark:bg-error-900/20 dark:text-error-300">
              {error}
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
            <h2 className="text-lg font-semibold text-success-700 dark:text-success-300">
              CSV importado correctamente
            </h2>

            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {resultado.usuarioId ?? USUARIO_DEMO} quedó listo para usar en el
              dashboard y el asistente IA.
            </p>

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

            <div className="mt-5 rounded-lg bg-white/70 p-4 text-sm dark:bg-gray-900/40">
              Perfil calculado:{' '}
              <strong>
                {resultado.perfilFinanciero ?? 'Sin determinar'}
              </strong>
            </div>
          </div>
        )}
      </div>
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
