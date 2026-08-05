import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import PageBreadcrumb from '../components/common/PageBreadCrumb';
import PageMeta from '../components/common/PageMeta';
import { MailIcon, TimeIcon, ChatIcon, DocsIcon, TaskIcon, LockIcon, PaperPlaneIcon, BoltIcon } from '../icons';
import { useAuth } from '../context/AuthContext';
import { preguntarAgente } from '../services/api';
import { renderMensajeAsistente } from '../utils/renderMensajeAsistente';
import { speakText, stopSpeaking, isSpeechSupported } from '../utils/speech';
import { playSendSound, playReceiveSound, playErrorSound, startTypingSound, stopTypingSound } from '../utils/sound';
import { setAgentTabStatus } from '../utils/tabTitle';
import { notifySupportMailOpened } from '../utils/supportSuccess';

const SOPORTE_EMAIL = 'g9latamteam29@gmail.com';
const MAILTO_HREF = `mailto:${SOPORTE_EMAIL}?subject=Soporte%20FinSightAI`;

const SUGERENCIAS_SOPORTE = [
  'No puedo exportar mi informe en PDF',
  'No me deja importar el archivo CSV',
  '¿Cómo cambio mi contraseña?',
  'El botón de descargar no funciona',
];

interface MensajeSoporte {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

function PersonaHablandoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="8" r="3" fill="currentColor" />
      <path
        d="M4 19c0-2.76 2.24-5 5-5s5 2.24 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M15.8 7.5c.7.7 1.1 1.56 1.1 2.5s-.4 1.8-1.1 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 5.3c1.27 1.27 2 3 2 4.7s-.73 3.43-2 4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function ChatSoporte() {
  const { usuarioId } = useAuth();
  const [mensajes, setMensajes] = useState<MensajeSoporte[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [vozActiva, setVozActiva] = useState(
    () => localStorage.getItem('asistenteVozActiva') === 'true'
  );
  const [sonidoActivo, setSonidoActivo] = useState(
    () => localStorage.getItem('asistenteSonidoActivo') !== 'false'
  );

  useEffect(() => {
    localStorage.setItem('asistenteVozActiva', String(vozActiva));
    if (!vozActiva) stopSpeaking();
  }, [vozActiva]);

  useEffect(() => {
    localStorage.setItem('asistenteSonidoActivo', String(sonidoActivo));
    if (!sonidoActivo) stopTypingSound();
  }, [sonidoActivo]);

  useEffect(() => () => {
    stopSpeaking();
    stopTypingSound();
  }, []);

  const enviar = async (texto: string) => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;

    const previousAnswer = [...mensajes].reverse().find((m) => m.role === 'assistant')?.text;

    setMensajes((prev) => [...prev, { id: prev.length + 1, role: 'user', text: limpio }]);
    setPregunta('');
    setEnviando(true);
    setAgentTabStatus('💬 Finsi está escribiendo...');
    if (sonidoActivo) {
      playSendSound();
      startTypingSound();
    }
    try {
      const { answer } = await preguntarAgente(limpio, usuarioId, previousAnswer);
      setMensajes((prev) => [...prev, { id: prev.length + 1, role: 'assistant', text: answer }]);
      setAgentTabStatus('✅ Finsi ha respondido', 2000);
      if (sonidoActivo) playReceiveSound();
      if (vozActiva) speakText(answer);
    } catch {
      setAgentTabStatus('✅ Finsi ha respondido', 2000);
      if (sonidoActivo) playErrorSound();
      setMensajes((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: 'assistant',
          text: 'No pude conectarme al servicio de soporte en este momento. Intenta de nuevo o escríbenos por correo.',
        },
      ]);
    } finally {
      stopTypingSound();
      setEnviando(false);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10">
            <ChatIcon className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Chat con Finsi</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Asistente de soporte técnico, disponible al instante.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setSonidoActivo((prev) => !prev)}
            title={sonidoActivo ? 'Desactivar efectos de sonido' : 'Activar efectos de sonido'}
            aria-label={sonidoActivo ? 'Desactivar efectos de sonido' : 'Activar efectos de sonido'}
            aria-pressed={sonidoActivo}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              sonidoActivo
                ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                : 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/[0.06]'
            }`}
          >
            <BoltIcon className="size-4" />
          </button>
          {isSpeechSupported() && (
            <button
              onClick={() => setVozActiva((prev) => !prev)}
              title={vozActiva ? 'Desactivar voz de lectura' : 'Activar voz de lectura'}
              aria-label={vozActiva ? 'Desactivar voz de lectura' : 'Activar voz de lectura'}
              aria-pressed={vozActiva}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                vozActiva
                  ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                  : 'text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/[0.06]'
              }`}
            >
              <PersonaHablandoIcon className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar mb-3 min-h-[8rem] flex-1 space-y-3 overflow-y-auto lg:min-h-0">
        {mensajes.length === 0 ? (
          <div className="space-y-3">
            <div className="flex justify-center">
              <img src="/images/mascot/finsight-bird-support.png" alt="Finsi, asistente de soporte" className="h-36 w-auto object-contain sm:h-44" />
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Cuéntanos qué problema tienes con la app (errores, importación/exportación, cuenta, etc.) y
              Finsi intentará ayudarte antes de escalar el caso por correo.{' '}
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Este chat no responde consultas financieras
              </span>{' '}
              (gastos, ahorro, presupuesto) — para eso usa el{' '}
              <Link to="/asistente-ia" className="text-brand-500 hover:underline">
                Asistente IA
              </Link>
              .
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGERENCIAS_SOPORTE.map((sugerencia) => (
                <button
                  key={sugerencia}
                  onClick={() => void enviar(sugerencia)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-theme-xs text-gray-600 transition hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-brand-800"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensajes.map((mensaje) => (
            <div
              key={mensaje.id}
              className={`flex ${mensaje.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-theme-sm ${
                  mensaje.role === 'user'
                    ? 'whitespace-pre-line bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                {mensaje.role === 'assistant' ? renderMensajeAsistente(mensaje.text) : mensaje.text}
              </div>
            </div>
          ))
        )}
        {enviando && (
          <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current" />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void enviar(pregunta);
            }
          }}
          rows={1}
          placeholder="Escribe tu consulta de soporte..."
          className="flex-1 resize-none rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30"
        />
        <button
          onClick={() => void enviar(pregunta)}
          disabled={enviando || !pregunta.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Enviar consulta"
        >
          <PaperPlaneIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
        <div className="lg:col-span-2">
          <ChatSoporte />
        </div>

        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Contacto</h4>

          <span className="relative mb-4 inline-flex h-20 w-20 shrink-0 rounded-full">
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-brand-50 ring-1 ring-gray-200 dark:bg-brand-500/10 dark:ring-gray-800">
              <img src="/logo_team.png" alt="TwentyNineDevs" className="h-full w-full object-cover" />
            </span>
            <span
              className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"
              aria-label="Equipo en línea"
            />
          </span>

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
              <p className="text-xs leading-normal text-gray-500 dark:text-gray-400">Horario de atención</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">Lunes a viernes, 9:00 - 18:00</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Respuesta por correo dentro de 24-48 horas hábiles</p>
            </div>
          </div>

          <div className="mb-6 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
              <DocsIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs leading-normal text-gray-500 dark:text-gray-400">Recursos</p>
              <a
                href="#preguntas-frecuentes"
                className="text-sm font-medium text-brand-500 hover:text-brand-600"
              >
                Ver preguntas frecuentes
              </a>
            </div>
          </div>

          <div className="flex-1" />

          <a
            href={MAILTO_HREF}
            onClick={notifySupportMailOpened}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <MailIcon className="h-4 w-4" />
            Contactar por correo
          </a>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:col-span-2 lg:p-6">
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

        <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div
            id="preguntas-frecuentes"
            className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6"
          >
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
      </div>
    </>
  );
}
