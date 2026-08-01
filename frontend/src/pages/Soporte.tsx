import { Link } from 'react-router';
import PageBreadcrumb from '../components/common/PageBreadCrumb';
import PageMeta from '../components/common/PageMeta';
import { MailIcon, TimeIcon, ChatIcon, DocsIcon, TaskIcon, LockIcon } from '../icons';

const SOPORTE_EMAIL = 'g9latamteam29@gmail.com';
const MAILTO_HREF = `mailto:${SOPORTE_EMAIL}?subject=Soporte%20FinSightAI`;

const PREGUNTAS_FRECUENTES = [
  {
    pregunta: '¿Cómo importo mis transacciones?',
    respuesta:
      'Desde el menú lateral entra a "Importar CSV" y sube tu archivo siguiendo el formato de la plantilla descargable. Tus movimientos quedarán disponibles en Transacciones y en el Dashboard.',
  },
  {
    pregunta: '¿Cómo cambio mi contraseña o cierro sesión en otros dispositivos?',
    respuesta:
      'Entra a tu perfil, en la sección "Seguridad", donde puedes actualizar tu contraseña y cerrar sesiones activas en otros dispositivos.',
  },
  {
    pregunta: '¿Puedo eliminar mi cuenta?',
    respuesta:
      'Sí. En tu perfil, en la "Zona de peligro", puedes solicitar la baja de tu cuenta. Tus datos financieros se conservan según nuestra Política de Privacidad.',
  },
  {
    pregunta: '¿Cómo exporto mis reportes?',
    respuesta:
      'Desde el Dashboard, Análisis o Transacciones puedes usar el botón "Exportar" para descargar tus datos en CSV, Excel o PDF, e incluso un Excel del dashboard con gráficos nativos.',
  },
];

const ENLACES_RAPIDOS = [
  { titulo: 'Importar CSV', descripcion: 'Carga tus movimientos financieros.', to: '/importar-csv' },
  { titulo: 'Seguridad de la cuenta', descripcion: 'Contraseña, sesiones y baja de cuenta.', to: '/profile#seguridad' },
  { titulo: 'Términos y condiciones', descripcion: 'Condiciones de uso de la plataforma.', to: '/terminos' },
  { titulo: 'Política de privacidad', descripcion: 'Cómo tratamos tus datos.', to: '/privacidad' },
];

export default function Soporte() {
  return (
    <>
      <PageMeta title="Soporte | FinSightAI" description="Contacto y soporte de FinSightAI" />
      <PageBreadcrumb pageTitle="Soporte" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                <ChatIcon className="h-5 w-5" />
              </span>
              <div>
                <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
                  ¿Necesitas ayuda?
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  FinSightAI es una plataforma de gestión financiera personal desarrollada por el
                  equipo TwentyNineDevs. Si tienes dudas, encontraste un problema o quieres
                  dejarnos tu feedback, escríbenos y te responderemos a la brevedad.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                <DocsIcon className="h-5 w-5" />
              </span>
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Preguntas frecuentes
              </h4>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {PREGUNTAS_FRECUENTES.map((item) => (
                <details key={item.pregunta} className="group py-3 first:pt-0 last:pb-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-gray-800 dark:text-white/90">
                    {item.pregunta}
                    <span className="shrink-0 text-gray-400 transition-transform group-open:rotate-45 dark:text-gray-500">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{item.respuesta}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                <TaskIcon className="h-5 w-5" />
              </span>
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Enlaces rápidos
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ENLACES_RAPIDOS.map((enlace) => (
                <Link
                  key={enlace.to}
                  to={enlace.to}
                  className="rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.04]"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">{enlace.titulo}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enlace.descripcion}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Contacto</h4>

            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <TaskIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs leading-normal text-gray-500 dark:text-gray-400">Equipo</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">TwentyNineDevs</p>
              </div>
            </div>

            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <MailIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs leading-normal text-gray-500 dark:text-gray-400">Correo de soporte</p>
                <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{SOPORTE_EMAIL}</p>
              </div>
            </div>

            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <TimeIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs leading-normal text-gray-500 dark:text-gray-400">Tiempo de respuesta</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">Dentro de 24-48 horas hábiles</p>
              </div>
            </div>

            <a
              href={MAILTO_HREF}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              <MailIcon className="h-4 w-4" />
              Contactar por correo
            </a>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <LockIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">Tu privacidad importa</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Nunca te pediremos tu contraseña por correo. Consulta nuestra{' '}
                  <Link to="/privacidad" className="text-brand-500 hover:text-brand-600">
                    política de privacidad
                  </Link>{' '}
                  para más detalles.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
