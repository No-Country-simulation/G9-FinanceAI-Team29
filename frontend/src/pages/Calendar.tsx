import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { EventInput, DateSelectArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import {
  obtenerMetas,
  obtenerTransacciones,
  obtenerEventosCalendario,
  crearEventoCalendario,
  actualizarEventoCalendario,
  eliminarEventoCalendario,
  obtenerTokenCalendario,
  suscribirNotificacionesPush,
} from "../services/api";
import type { Goal, EventoCalendario, TipoEventoCalendario } from "../types/finance";
import { mostrarError, mostrarExito } from "../utils/alerts";
import { SkeletonBlock } from "../components/common/Skeleton";
import { speakText, stopSpeaking, isSpeechSupported } from "../utils/speech";

/** Convierte la clave pública VAPID (base64url) al formato que pide pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/** Traduce un evento manual ya guardado en el backend al formato que usa FullCalendar. */
function construirEventoDesdeManual(evento: EventoCalendario): CalendarEvent {
  return {
    id: evento.id,
    title: evento.titulo,
    start: evento.fechaInicio,
    end: evento.fechaFin ?? undefined,
    allDay: true,
    editable: true,
    extendedProps: {
      calendar: evento.tipo,
      esReal: false,
    },
  };
}

/** Arma eventos reales a partir de metas activas (fecha límite) y transacciones
 * recurrentes (próxima ocurrencia estimada a 1 mes de la última registrada).
 * Las metas son el eje del calendario financiero: se destacan con más datos
 * (progreso, monto restante) para que salten a la vista frente a los demás eventos.
 * Todo evento generado acá lleva `esReal: true` para diferenciarlo de los que
 * el usuario agrega manualmente (esos siguen siendo editables como antes). */
function construirEventosReales(
  metas: Goal[],
  transacciones: Awaited<ReturnType<typeof obtenerTransacciones>>
): CalendarEvent[] {
  const eventos: CalendarEvent[] = [];

  const hoyMetas = new Date();
  metas
    .filter((m) => m.estado === "ACTIVA" && m.fechaObjetivo)
    .forEach((m) => {
      eventos.push({
        id: `meta-${m.id}`,
        title: `Meta: ${m.nombre}`,
        start: m.fechaObjetivo!.split("T")[0],
        allDay: true,
        editable: false,
        extendedProps: {
          calendar: "Meta",
          esReal: true,
          nombreMeta: m.nombre,
          progreso: m.progreso,
          montoObjetivo: m.montoObjetivo,
          montoRestante: m.montoRestante,
          reservaMensualSugerida: m.reservaMensualSugerida,
          diasRestantes: Math.ceil(
            (new Date(m.fechaObjetivo!).getTime() - hoyMetas.getTime()) / 86400000
          ),
        },
      });
    });

  const ultimaPorGrupo = new Map<string, (typeof transacciones)[number]>();
  transacciones
    .filter((t) => t.recurrente)
    .forEach((t) => {
      const clave = `${t.tipo}|${t.categoria}|${t.descripcion}`;
      const actual = ultimaPorGrupo.get(clave);
      if (!actual || new Date(t.fecha) > new Date(actual.fecha)) {
        ultimaPorGrupo.set(clave, t);
      }
    });

  const hoy = new Date();
  ultimaPorGrupo.forEach((t, clave) => {
    const proxima = new Date(t.fecha);
    proxima.setMonth(proxima.getMonth() + 1);
    if (proxima < hoy) return;
    eventos.push({
      id: `recurrente-${clave}`,
      title:
        t.tipo === "Ingreso"
          ? `Ingreso recurrente: ${t.descripcion}`
          : `Pago recurrente: ${t.descripcion}`,
      start: proxima.toISOString().split("T")[0],
      allDay: true,
      editable: false,
      extendedProps: {
        calendar: t.tipo === "Ingreso" ? "Ingreso" : "Pago",
        esReal: true,
        monto: t.monto,
        categoriaTransaccion: t.categoria,
        ultimaFecha: t.fecha,
      },
    });
  });

  return eventos;
}

interface CalendarEvent extends EventInput {
  extendedProps: {
    calendar: string;
    esReal?: boolean;
    nombreMeta?: string;
    progreso?: number;
    montoObjetivo?: number;
    montoRestante?: number;
    reservaMensualSugerida?: number | null;
    diasRestantes?: number;
    monto?: number;
    categoriaTransaccion?: string;
    ultimaFecha?: string;
  };
}

type PrioridadRecomendacion = "alta" | "media" | "sugerencia";

interface RecomendacionMeta {
  prioridad: PrioridadRecomendacion;
  titulo: string;
  diagnostico: string;
  accion: string;
  objetivo: string;
  advertencia: string;
  preguntaFinsi: string;
}

/** Recomendación simple generada en el cliente a partir de los datos de la propia
 * meta (progreso, monto restante, días hasta la fecha límite y ahorro mensual
 * sugerido). No reemplaza al análisis financiero del backend: es una orientación
 * puntual pensada para acompañar cada meta dentro del calendario. */
function generarRecomendacionMeta(props: CalendarEvent["extendedProps"]): RecomendacionMeta {
  const nombre = props.nombreMeta || "tu meta";
  const progreso = props.progreso ?? 0;
  const montoRestante = props.montoRestante ?? 0;
  const diasRestantes = props.diasRestantes ?? 0;
  const reserva = props.reservaMensualSugerida;
  const sugerenciaAporte = reserva
    ? `Reserva ${formatoMoneda.format(reserva)} este mes para no perder el ritmo.`
    : `Reserva una parte de tus próximos ingresos para acercarte a "${nombre}".`;
  const advertencia =
    "Esta orientación se basa en los datos que registraste en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero.";

  if (progreso >= 100) {
    return {
      prioridad: "sugerencia",
      titulo: "¡Meta cumplida!",
      diagnostico: `Ya alcanzaste el 100% de "${nombre}". `,
      accion: "Marca la meta como completada en Metas o define una nueva para seguir el hábito de ahorro.",
      objetivo: "Elegir tu próxima meta financiera.",
      advertencia,
      preguntaFinsi: `Ya completé mi meta "${nombre}". ¿Qué meta financiera me conviene armar ahora?`,
    };
  }

  if (diasRestantes < 0) {
    return {
      prioridad: "alta",
      titulo: "Fecha límite vencida",
      diagnostico: `La fecha objetivo de "${nombre}" ya pasó y llevas un ${Math.round(progreso)} por ciento completado (faltan ${formatoMoneda.format(montoRestante)}).`,
      accion: "Revisa si conviene extender la fecha límite o aumentar el aporte mensual para alcanzarla pronto.",
      objetivo: "Actualizar la fecha objetivo o el monto de ahorro mensual desde Metas.",
      advertencia,
      preguntaFinsi: `Se venció la fecha de mi meta "${nombre}" y llevo ${Math.round(progreso)} por ciento. ¿Cómo la reorganizo?`,
    };
  }

  if (diasRestantes <= 7 && progreso < 90) {
    return {
      prioridad: "alta",
      titulo: "Se acerca la fecha límite",
      diagnostico: `Faltan ${diasRestantes} días para "${nombre}" y todavía te falta reunir ${formatoMoneda.format(montoRestante)}.`,
      accion: sugerenciaAporte,
      objetivo: `Llegar al 100% antes de la fecha límite.`,
      advertencia,
      preguntaFinsi: `Me quedan ${diasRestantes} días para mi meta "${nombre}" y me faltan ${formatoMoneda.format(montoRestante)}. ¿Cómo la puedo alcanzar a tiempo?`,
    };
  }

  if (diasRestantes <= 30 && progreso < 60) {
    return {
      prioridad: "media",
      titulo: "Vas un poco atrasado",
      diagnostico: `Con ${diasRestantes} días por delante y un ${Math.round(progreso)} por ciento de avance, conviene sostener un aporte constante en "${nombre}".`,
      accion: sugerenciaAporte,
      objetivo: `Llegar al 100% antes de la fecha límite.`,
      advertencia,
      preguntaFinsi: `Voy con ${Math.round(progreso)} por ciento en mi meta "${nombre}" y me quedan ${diasRestantes} días. ¿Cómo organizo mis ahorros?`,
    };
  }

  return {
    prioridad: "sugerencia",
    titulo: "Vas por buen camino",
    diagnostico: `Llevas un ${Math.round(progreso)} por ciento de "${nombre}" y todavía tienes ${diasRestantes} días para completarla.`,
    accion: sugerenciaAporte,
    objetivo: `Mantener el ritmo de ahorro hasta llegar al 100%.`,
    advertencia,
    preguntaFinsi: `Voy bien con mi meta "${nombre}" (${Math.round(progreso)} por ciento). ¿Cómo mantengo el ritmo de ahorro?`,
  };
}

const colorPorPrioridad: Record<PrioridadRecomendacion, string> = {
  alta: "border-l-error-500 bg-error-50 dark:bg-error-500/10",
  media: "border-l-warning-500 bg-warning-50 dark:bg-warning-500/10",
  sugerencia: "border-l-info-500 bg-info-50 dark:bg-info-500/10",
};

const iconoPorPrioridad: Record<PrioridadRecomendacion, string> = {
  alta: "🔴",
  media: "🟡",
  sugerencia: "🔵",
};

const etiquetaPorPrioridad: Record<PrioridadRecomendacion, string> = {
  alta: "Prioridad Alta",
  media: "Prioridad Media",
  sugerencia: "Sugerencia",
};

/** Misma idea que generarRecomendacionMeta pero para los pagos/ingresos recurrentes:
 * no hay meta detrás, así que la recomendación se limita a anticipar el movimiento
 * y sugerir una acción simple (reservar el monto o destinarlo a una meta). */
function generarRecomendacionTransaccion(props: CalendarEvent["extendedProps"]): RecomendacionMeta {
  const esIngreso = props.calendar === "Ingreso";
  const monto = formatoMoneda.format(props.monto ?? 0);
  const categoria = props.categoriaTransaccion || "sin categoría";
  const advertencia =
    "Esta orientación se basa en los datos que registraste en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero.";

  if (esIngreso) {
    return {
      prioridad: "sugerencia",
      titulo: "Ingreso recurrente esperado",
      diagnostico: `Todos los meses sueles registrar un ingreso de ${monto} en la categoría ${categoria}.`,
      accion: "Aprovecha este ingreso para reforzar tus metas de ahorro activas apenas lo recibas.",
      objetivo: "Destinar una parte de este ingreso a una meta antes de gastarlo.",
      advertencia,
      preguntaFinsi: `Voy a recibir un ingreso recurrente de ${monto} (${categoria}). ¿Cómo lo distribuyo entre gastos y ahorro?`,
    };
  }

  return {
    prioridad: "media",
    titulo: "Pago recurrente que se acerca",
    diagnostico: `Todos los meses registras un pago de ${monto} en la categoría ${categoria}.`,
    accion: "Reserva ese monto con anticipación para que no te tome por sorpresa ni afecte tus metas.",
    objetivo: "Evitar que este gasto fijo compita con tu ahorro del mes.",
    advertencia,
    preguntaFinsi: `Tengo un pago recurrente de ${monto} (${categoria}). ¿Cómo lo organizo sin afectar mis ahorros?`,
  };
}

/** Recomendación genérica para los eventos que el usuario agrega a mano (no vienen
 * de Metas ni de transacciones reales), así que no hay monto ni categoría real
 * detrás: la orientación se basa solo en el título y el tipo elegido. */
function generarRecomendacionManual(tipo: string, titulo: string): RecomendacionMeta {
  const advertencia =
    "Este evento lo agregaste manualmente, no está vinculado a tus datos financieros registrados. Esta orientación es general.";

  if (tipo === "Meta") {
    return {
      prioridad: "sugerencia",
      titulo: "Convierte esto en una meta real",
      diagnostico: `Anotaste "${titulo}" como una meta en el calendario.`,
      accion: "Si es una meta de ahorro real, créala en la sección Metas para hacerle seguimiento automático de progreso.",
      objetivo: "Vincular este evento con una meta formal para no perderle el rastro.",
      advertencia,
      preguntaFinsi: `Quiero organizar una meta financiera: "${titulo}". ¿Cómo la planifico?`,
    };
  }

  if (tipo === "Ingreso") {
    return {
      prioridad: "sugerencia",
      titulo: "Planifica este ingreso",
      diagnostico: `Anotaste "${titulo}" como un ingreso esperado.`,
      accion: "Cuando lo recibas, regístralo como transacción para que se refleje en tus reportes y metas.",
      objetivo: "Aprovechar este ingreso para reforzar tu ahorro.",
      advertencia,
      preguntaFinsi: `Voy a recibir un ingreso: "${titulo}". ¿Cómo lo distribuyo entre gastos y ahorro?`,
    };
  }

  if (tipo === "Pago") {
    return {
      prioridad: "media",
      titulo: "Anticipa este pago",
      diagnostico: `Anotaste "${titulo}" como un pago pendiente.`,
      accion: "Reserva el monto con anticipación para que no afecte tus otros gastos ni tus metas.",
      objetivo: "Cubrir este pago sin descuidar tu ahorro del mes.",
      advertencia,
      preguntaFinsi: `Tengo que hacer un pago: "${titulo}". ¿Cómo lo organizo sin afectar mis ahorros?`,
    };
  }

  return {
    prioridad: "sugerencia",
    titulo: "No lo pierdas de vista",
    diagnostico: `Dejaste un recordatorio financiero: "${titulo}".`,
    accion: "Revisa el calendario cerca de esa fecha para no olvidarlo.",
    objetivo: "Cumplir con este recordatorio a tiempo.",
    advertencia,
    preguntaFinsi: `Tengo un recordatorio financiero: "${titulo}". ¿Qué debería tener en cuenta?`,
  };
}

function RecomendacionCard({
  rec,
  onPreguntar,
  altMascota,
}: {
  rec: RecomendacionMeta;
  onPreguntar: (rec: RecomendacionMeta) => void;
  altMascota: string;
}) {
  const [leyendo, setLeyendo] = useState(false);

  useEffect(() => stopSpeaking, []);

  const leerRecomendacion = async () => {
    if (leyendo) {
      stopSpeaking();
      setLeyendo(false);
      return;
    }
    setLeyendo(true);
    const texto = [
      rec.titulo,
      rec.diagnostico,
      `Acción sugerida: ${rec.accion}`,
      rec.objetivo ? `Objetivo: ${rec.objetivo}` : null,
    ].filter(Boolean).join('. ');
    await speakText(texto);
    setLeyendo(false);
  };

  return (
    <div className={`rounded-lg border-l-4 p-4 ${colorPorPrioridad[rec.prioridad]}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{iconoPorPrioridad[rec.prioridad]}</span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-medium text-gray-800 dark:text-white/90">
            {etiquetaPorPrioridad[rec.prioridad]}
          </p>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{rec.titulo}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{rec.diagnostico}</p>
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            <strong>Acción sugerida:</strong> {rec.accion}
          </p>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            <strong>Objetivo:</strong> {rec.objetivo}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{rec.advertencia}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col items-center gap-2 rounded-lg bg-brand-50 p-4 text-center dark:bg-brand-500/10">
        <img
          src="/images/mascot/mascot-thinking.png"
          alt={altMascota}
          className="h-28 w-auto object-contain sm:h-32"
        />
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onPreguntar(rec)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            💬 Preguntar a Finsi sobre esto
          </button>
          {isSpeechSupported() && (
            <button
              type="button"
              onClick={leerRecomendacion}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 dark:border-brand-800 dark:bg-white/[0.03] dark:text-brand-400 dark:hover:bg-white/[0.06]"
            >
              {leyendo ? '⏹️ Detener lectura' : '🔊 Que Finsi lo lea'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Ícono a color por tipo de evento (no emoji, para que se vea igual en todos los sistemas). */
function EventIcon({ calendar, className = "h-4 w-4" }: { calendar: string; className?: string }) {
  switch (calendar) {
    case "Meta":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#8B5CF6" />
          <circle cx="12" cy="12" r="5.5" fill="#EDE9FE" />
          <circle cx="12" cy="12" r="2" fill="#8B5CF6" />
        </svg>
      );
    case "Ingreso":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#12B76A" />
          <path d="M12 16V8m0 0-3.5 3.5M12 8l3.5 3.5" stroke="#ECFDF3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Pago":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#F04438" />
          <path d="M12 8v8m0 0 3.5-3.5M12 16l-3.5-3.5" stroke="#FEF3F2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="#F79009" />
          <circle cx="12" cy="8.5" r="1.2" fill="#FFFAEB" />
          <rect x="11" y="11" width="2" height="5.5" rx="1" fill="#FFFAEB" />
        </svg>
      );
  }
}

const Calendar: React.FC = () => {
  const { usuarioId } = useAuth();
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [eventTitle, setEventTitle] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLevel, setEventLevel] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [metas, setMetas] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiposActivos, setTiposActivos] = useState<Set<string>>(
    new Set(["Pago", "Ingreso", "Meta", "Recordatorio"])
  );
  const [editandoEventoManual, setEditandoEventoManual] = useState(false);
  const [pushActivo, setPushActivo] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  const { isOpen, openModal, closeModal } = useModal();

  const toggleTipo = (tipo: string) => {
    setTiposActivos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  };

  const eventosFiltrados = useMemo(
    () => events.filter((e) => tiposActivos.has(e.extendedProps.calendar)),
    [events, tiposActivos]
  );

  const metasDestacadas = useMemo(() => {
    const hoy = new Date();
    return metas
      .filter((m) => m.estado === "ACTIVA" && m.fechaObjetivo)
      .map((m) => ({
        ...m,
        diasRestantes: Math.ceil(
          (new Date(m.fechaObjetivo!).getTime() - hoy.getTime()) / 86400000
        ),
      }))
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 4);
  }, [metas]);

  const fechasConMeta = useMemo(
    () =>
      new Set(
        metas
          .filter((m) => m.estado === "ACTIVA" && m.fechaObjetivo)
          .map((m) => m.fechaObjetivo!.split("T")[0])
      ),
    [metas]
  );

  const calendarsEvents = {
    Pago: "danger",
    Ingreso: "success",
    Meta: "primary",
    Recordatorio: "warning",
  };

  useEffect(() => {
    let cancelado = false;
    if (!usuarioId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      obtenerMetas(usuarioId),
      obtenerTransacciones(usuarioId),
      obtenerEventosCalendario(usuarioId),
    ])
      .then(([metasCargadas, transacciones, eventosManuales]) => {
        if (cancelado) return;
        setMetas(metasCargadas);
        setEvents([
          ...construirEventosReales(metasCargadas, transacciones),
          ...eventosManuales.map(construirEventoDesdeManual),
        ]);
      })
      .catch((error) => {
        console.error("No se pudieron cargar los eventos del calendario financiero", error);
        if (!cancelado) {
          setMetas([]);
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker
      .getRegistration()
      .then((registro) => registro?.pushManager.getSubscription())
      .then((suscripcion) => setPushActivo(Boolean(suscripcion)))
      .catch(() => setPushActivo(false));
  }, []);

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    resetModalFields();
    setEventStartDate(selectInfo.startStr);
    setEventEndDate(selectInfo.endStr || selectInfo.startStr);
    setEditandoEventoManual(true);
    openModal();
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = clickInfo.event;
    setSelectedEvent(event as unknown as CalendarEvent);
    setEventTitle(event.title);
    setEventStartDate(event.start?.toISOString().split("T")[0] || "");
    setEventEndDate(event.end?.toISOString().split("T")[0] || "");
    setEventLevel(event.extendedProps.calendar);
    // Los eventos reales (Meta/Pago/Ingreso) siempre muestran su viñeta de detalle.
    // Los manuales también arrancan mostrando la viñeta con la recomendación de
    // Finsi; el usuario entra al formulario de edición recién si toca "Editar".
    setEditandoEventoManual(false);
    openModal();
  };

  const esEventoReal = Boolean(selectedEvent?.extendedProps.esReal);

  const abrirDetalleMeta = (m: Goal & { diasRestantes: number }) => {
    setSelectedEvent({
      id: `meta-${m.id}`,
      title: `Meta: ${m.nombre}`,
      start: m.fechaObjetivo!.split("T")[0],
      extendedProps: {
        calendar: "Meta",
        esReal: true,
        nombreMeta: m.nombre,
        progreso: m.progreso,
        montoObjetivo: m.montoObjetivo,
        montoRestante: m.montoRestante,
        reservaMensualSugerida: m.reservaMensualSugerida,
        diasRestantes: m.diasRestantes,
      },
    });
    setEventTitle(`Meta: ${m.nombre}`);
    setEventStartDate(m.fechaObjetivo!.split("T")[0]);
    setEventEndDate(m.fechaObjetivo!.split("T")[0]);
    setEventLevel("Meta");
    setEditandoEventoManual(false);
    openModal();
  };

  const preguntarleAFinsi = (rec: RecomendacionMeta) => {
    const contexto = [
      rec.preguntaFinsi,
      `Diagnóstico: ${rec.diagnostico}`,
      `Acción sugerida: ${rec.accion}`,
      `Objetivo: ${rec.objetivo}`,
      rec.advertencia,
      "Continúa desde esta recomendación, usa mis datos financieros actuales y no me pidas que repita el contexto.",
    ]
      .filter(Boolean)
      .join("\n\n");
    closeModal();
    navigate("/asistente-ia", { state: { autoPrompt: contexto } });
  };

  const camposEventoValidos = () => {
    if (!eventTitle.trim()) {
      mostrarError("Falta el título", "Escribe un título para el evento antes de guardarlo.");
      return false;
    }
    if (!eventLevel) {
      mostrarError("Falta el tipo de evento", "Elige una categoría: Pago, Ingreso, Meta o Recordatorio.");
      return false;
    }
    if (!eventStartDate) {
      mostrarError("Falta la fecha de inicio", "Selecciona una fecha de inicio para el evento.");
      return false;
    }
    if (eventEndDate && eventEndDate < eventStartDate) {
      mostrarError("Fechas inválidas", "La fecha de fin no puede ser anterior a la fecha de inicio.");
      return false;
    }
    return true;
  };

  const handleAddOrUpdateEvent = async () => {
    if (!camposEventoValidos()) return;
    if (!usuarioId) return;
    const datos = {
      titulo: eventTitle,
      tipo: eventLevel as TipoEventoCalendario,
      fechaInicio: eventStartDate,
      fechaFin: eventEndDate || null,
    };
    try {
      if (selectedEvent) {
        // Actualizar evento manual existente en el backend
        const actualizado = await actualizarEventoCalendario(String(selectedEvent.id), datos, usuarioId);
        setEvents((prevEvents) =>
          prevEvents.map((event) =>
            event.id === selectedEvent.id ? construirEventoDesdeManual(actualizado) : event
          )
        );
        closeModal();
        resetModalFields();
        mostrarExito("Evento actualizado", "Los cambios se guardaron correctamente.");
      } else {
        // Crear evento manual nuevo en el backend
        const creado = await crearEventoCalendario(datos, usuarioId);
        setEvents((prevEvents) => [...prevEvents, construirEventoDesdeManual(creado)]);
        closeModal();
        resetModalFields();
        mostrarExito("Evento creado", "Tu evento se agregó al calendario.");
      }
    } catch (error) {
      mostrarError("No se pudo guardar el evento", error instanceof Error ? error.message : undefined);
    }
  };

  const resetModalFields = () => {
    setEventTitle("");
    setEventStartDate("");
    setEventEndDate("");
    setEventLevel("");
    setSelectedEvent(null);
    setEditandoEventoManual(true);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !usuarioId) return;
    try {
      await eliminarEventoCalendario(String(selectedEvent.id), usuarioId);
      setEvents((prevEvents) => prevEvents.filter((event) => event.id !== selectedEvent.id));
      closeModal();
      resetModalFields();
      mostrarExito("Evento eliminado", "El evento se quitó del calendario.");
    } catch (error) {
      mostrarError("No se pudo eliminar el evento", error instanceof Error ? error.message : undefined);
    }
  };

  /** Reprograma un evento agregado a mano al arrastrarlo o cambiarle la duración,
   * guardando el nuevo rango de fechas en el backend. Los eventos reales (esReal)
   * no son arrastrables (editable: false), así que esto solo corre para los
   * eventos manuales creados desde "Agregar evento". Si falla el guardado, se
   * revierte visualmente el arrastre para no mostrar un estado desincronizado. */
  const handleEventDropOrResize = async (arg: EventDropArg | EventResizeDoneArg) => {
    if (!usuarioId) return;
    const { event } = arg;
    const nuevaFechaInicio = event.start?.toISOString().split("T")[0];
    const nuevaFechaFin = event.end?.toISOString().split("T")[0] ?? null;
    if (!nuevaFechaInicio) return;
    try {
      await actualizarEventoCalendario(
        String(event.id),
        { fechaInicio: nuevaFechaInicio, fechaFin: nuevaFechaFin },
        usuarioId
      );
      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === event.id ? { ...e, start: nuevaFechaInicio, end: nuevaFechaFin ?? undefined } : e
        )
      );
    } catch (error) {
      mostrarError("No se pudo reprogramar el evento", error instanceof Error ? error.message : undefined);
      arg.revert();
    }
  };

  const exportarICS = () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const aFechaICS = (valor: unknown) => {
      const d = new Date(`${String(valor)}T00:00:00`);
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    };
    const lineas = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FinSightAI//Calendario Financiero//ES",
    ];
    eventosFiltrados
      .filter((e) => e.start)
      .forEach((e) => {
        lineas.push(
          "BEGIN:VEVENT",
          `UID:${e.id}@finsightai`,
          `DTSTART;VALUE=DATE:${aFechaICS(e.start)}`,
          `SUMMARY:${String(e.title ?? "").replace(/\r?\n/g, " ")}`,
          "END:VEVENT"
        );
      });
    lineas.push("END:VCALENDAR");

    const blob = new Blob([lineas.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendario-financiero.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Pide permiso de notificaciones, registra el service worker y manda la
   * suscripción push al backend para que el job diario le pueda avisar. */
  const activarNotificacionesPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      mostrarError("No compatible", "Tu navegador no soporta notificaciones push.");
      return;
    }
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      mostrarError("Notificaciones no configuradas", "Falta la clave pública VAPID en el proyecto.");
      return;
    }
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        mostrarError(
          "Permiso denegado",
          "Activa los permisos de notificación desde el navegador para recibir recordatorios."
        );
        return;
      }
      const registro = await navigator.serviceWorker.register("/sw.js");
      const suscripcionExistente = await registro.pushManager.getSubscription();
      const suscripcion =
        suscripcionExistente ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));
      const json = suscripcion.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("La suscripción push no devolvió los datos esperados.");
      }
      await suscribirNotificacionesPush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setPushActivo(true);
      mostrarExito("Notificaciones activadas", "Te avisaremos cuando se acerque una meta o un pago.");
    } catch (error) {
      mostrarError(
        "No se pudieron activar las notificaciones",
        error instanceof Error ? error.message : undefined
      );
    }
  };

  /** Genera (si hace falta) el token del feed .ics y abre el link webcal:// para
   * que el usuario lo suscriba desde Google/Apple/Outlook Calendar. */
  const suscribirseCalendarioExterno = async () => {
    try {
      const token = await obtenerTokenCalendario();
      const urlHttp = `${window.location.origin}/api/calendario-ics?token=${token}`;
      window.open(urlHttp.replace(/^https?:\/\//, "webcal://"), "_blank");
    } catch (error) {
      mostrarError(
        "No se pudo generar el enlace",
        error instanceof Error ? error.message : undefined
      );
    }
  };

  return (
    <>
      <PageMeta
        title="Calendario Financiero | FinSightAI"
        description="Visualiza tus pagos, ingresos y fechas límite de metas en un calendario"
      />
      {loading && (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-center justify-between">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-4 w-16" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
              >
                <SkeletonBlock className="mb-2 h-4 w-3/4" />
                <SkeletonBlock className="mb-3 h-3 w-1/2" />
                <SkeletonBlock className="mb-2 h-2 w-full" />
                <SkeletonBlock className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && metasDestacadas.length > 0 && (
        <div id="metas-proximas-calendario" className="mb-6 scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-white/90">
              <EventIcon calendar="Meta" className="h-5 w-5" />
              Metas próximas
            </h3>
            <Link
              to="/metas"
              className="text-sm font-medium text-brand-500 hover:text-brand-600"
            >
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metasDestacadas.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => abrirDetalleMeta(m)}
                className={`rounded-xl border p-4 text-left transition-colors hover:border-brand-400 ${
                  m.diasRestantes <= 7
                    ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
                    : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                }`}
              >
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                  <EventIcon calendar="Meta" />
                  {m.nombre}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {m.diasRestantes < 0
                    ? "Fecha límite vencida"
                    : m.diasRestantes === 0
                    ? "¡Vence hoy!"
                    : `Faltan ${m.diasRestantes} días`}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(100, Math.max(0, m.progreso))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(m.progreso)}% completado
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-2xl border  border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]" data-tour="page-calendar">
        {loading && (
          <p className="px-4 pt-4 text-sm text-gray-500 dark:text-gray-400">
            Cargando eventos financieros…
          </p>
        )}
        <div id="acciones-calendario" className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(calendarsEvents).map((tipo) => {
              const activo = tiposActivos.has(tipo);
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => toggleTipo(tipo)}
                  title={activo ? `Ocultar ${tipo}` : `Mostrar ${tipo}`}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    activo
                      ? "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      : "border-gray-200 bg-transparent text-gray-400 opacity-50 dark:border-gray-700 dark:text-gray-500"
                  }`}
                >
                  <EventIcon calendar={tipo} className="h-3.5 w-3.5" />
                  {tipo}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={activarNotificacionesPush}
              disabled={pushActivo}
              title={pushActivo ? "Ya recibís notificaciones push" : "Activar recordatorios en este navegador"}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                pushActivo
                  ? "border-success-300 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-400"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              }`}
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {pushActivo ? "Recordatorios activados" : "Activar recordatorios"}
            </button>
            <button
              type="button"
              onClick={suscribirseCalendarioExterno}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Suscribir a Google/Apple Calendar
            </button>
            <button
              type="button"
              onClick={exportarICS}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar Calendario (.ics)
            </button>
          </div>
        </div>
        <div className="custom-calendar overflow-x-auto">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={esLocale}
            firstDay={1}
            headerToolbar={{
              left: "prev,next addEventButton",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
            }}
            events={eventosFiltrados}
            editable={true}
            eventDrop={handleEventDropOrResize}
            eventResize={handleEventDropOrResize}
            eventOrder={(a: any, b: any) =>
              (a.extendedProps?.calendar === "Meta" ? -1 : 0) -
              (b.extendedProps?.calendar === "Meta" ? -1 : 0)
            }
            dayCellClassNames={(arg) =>
              fechasConMeta.has(arg.date.toISOString().split("T")[0])
                ? ["fc-day-con-meta"]
                : []
            }
            selectable={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventContent={renderEventContent}
            customButtons={{
              addEventButton: {
                text: "Agregar evento +",
                click: () => {
                  resetModalFields();
                  openModal();
                },
              },
            }}
          />
        </div>
        <Modal
          isOpen={isOpen}
          onClose={closeModal}
          className="max-w-[700px] p-6 lg:p-10"
        >
          {esEventoReal && selectedEvent ? (
            <div className="flex flex-col px-2 overflow-y-auto custom-scrollbar">
              <div className="flex items-start gap-3">
                <EventIcon calendar={selectedEvent.extendedProps.calendar} className="h-9 w-9 shrink-0" />
                <div>
                  <h5 className="font-semibold text-gray-800 modal-title text-theme-xl dark:text-white/90 lg:text-2xl">
                    {eventTitle}
                  </h5>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {eventStartDate &&
                      new Date(eventStartDate + "T00:00:00").toLocaleDateString("es-AR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {selectedEvent.extendedProps.calendar === "Meta" && (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Progreso</span>
                        <span className="font-semibold text-gray-800 dark:text-white/90">
                          {Math.round(selectedEvent.extendedProps.progreso ?? 0)}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, selectedEvent.extendedProps.progreso ?? 0))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Monto objetivo</p>
                        <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">
                          {formatoMoneda.format(selectedEvent.extendedProps.montoObjetivo ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Falta reunir</p>
                        <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">
                          {formatoMoneda.format(selectedEvent.extendedProps.montoRestante ?? 0)}
                        </p>
                      </div>
                    </div>

                    <RecomendacionCard
                      rec={generarRecomendacionMeta(selectedEvent.extendedProps)}
                      onPreguntar={preguntarleAFinsi}
                      altMascota="Finsi pensando una recomendación para tu meta"
                    />
                  </>
                )}

                {(selectedEvent.extendedProps.calendar === "Ingreso" ||
                  selectedEvent.extendedProps.calendar === "Pago") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Monto habitual</p>
                        <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">
                          {formatoMoneda.format(selectedEvent.extendedProps.monto ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Categoría</p>
                        <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">
                          {selectedEvent.extendedProps.categoriaTransaccion || "—"}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Último registro</p>
                        <p className="mt-1 font-semibold text-gray-800 dark:text-white/90">
                          {selectedEvent.extendedProps.ultimaFecha
                            ? new Date(selectedEvent.extendedProps.ultimaFecha).toLocaleDateString("es-AR")
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <RecomendacionCard
                      rec={generarRecomendacionTransaccion(selectedEvent.extendedProps)}
                      onPreguntar={preguntarleAFinsi}
                      altMascota="Finsi pensando una recomendación para tu movimiento recurrente"
                    />
                  </>
                )}

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {selectedEvent.extendedProps.calendar === "Meta"
                    ? "Este evento se generó automáticamente a partir de tu meta de ahorro."
                    : "Fecha estimada a partir de un movimiento recurrente que ya registraste."}
                </p>
              </div>

              <div className="flex items-center gap-3 mt-6 modal-footer sm:justify-end">
                <button
                  onClick={closeModal}
                  type="button"
                  className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto"
                >
                  Cerrar
                </button>
                <Link
                  to={selectedEvent.extendedProps.calendar === "Meta" ? "/metas" : "/transacciones"}
                  onClick={closeModal}
                  className="flex w-full justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 sm:w-auto"
                >
                  {selectedEvent.extendedProps.calendar === "Meta" ? "Ver meta" : "Ver transacciones"}
                </Link>
              </div>
            </div>
          ) : selectedEvent && !editandoEventoManual ? (
            <div className="flex flex-col px-2 overflow-y-auto custom-scrollbar">
              <div className="flex items-start gap-3">
                <EventIcon calendar={selectedEvent.extendedProps.calendar} className="h-9 w-9 shrink-0" />
                <div>
                  <h5 className="font-semibold text-gray-800 modal-title text-theme-xl dark:text-white/90 lg:text-2xl">
                    {eventTitle}
                  </h5>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {eventStartDate &&
                      new Date(eventStartDate + "T00:00:00").toLocaleDateString("es-AR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <RecomendacionCard
                  rec={generarRecomendacionManual(selectedEvent.extendedProps.calendar, eventTitle)}
                  onPreguntar={preguntarleAFinsi}
                  altMascota="Finsi pensando una recomendación para tu evento"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Este evento lo agregaste manualmente desde el calendario.
                </p>
              </div>

              <div className="flex items-center gap-3 mt-6 modal-footer sm:justify-end">
                <button
                  onClick={handleDeleteEvent}
                  type="button"
                  className="mr-auto flex justify-center rounded-lg border border-error-300 px-4 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50 dark:border-error-500/40 dark:text-error-400 dark:hover:bg-error-500/10"
                >
                  Eliminar
                </button>
                <button
                  onClick={closeModal}
                  type="button"
                  className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => setEditandoEventoManual(true)}
                  type="button"
                  className="flex w-full justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 sm:w-auto"
                >
                  Editar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col px-2 overflow-y-auto custom-scrollbar">
              <div>
                <h5 className="mb-2 font-semibold text-gray-800 modal-title text-theme-xl dark:text-white/90 lg:text-2xl">
                  {selectedEvent ? "Editar evento" : "Agregar evento"}
                </h5>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Registra un pago, ingreso, fecha límite de meta o recordatorio
                  financiero
                </p>
              </div>
              <div className="mt-8">
                <div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                      Título del evento
                    </label>
                    <input
                      id="event-title"
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <label className="block mb-4 text-sm font-medium text-gray-700 dark:text-gray-400">
                    Tipo de evento
                  </label>
                  <div className="flex flex-wrap items-center gap-4 sm:gap-5">
                    {Object.entries(calendarsEvents).map(([key, value]) => (
                      <div key={key} className="n-chk">
                        <div
                          className={`form-check form-check-${value} form-check-inline`}
                        >
                          <label
                            className="flex items-center text-sm text-gray-700 form-check-label dark:text-gray-400"
                            htmlFor={`modal${key}`}
                          >
                            <span className="relative">
                              <input
                                className="sr-only form-check-input"
                                type="radio"
                                name="event-level"
                                value={key}
                                id={`modal${key}`}
                                checked={eventLevel === key}
                                onChange={() => setEventLevel(key)}
                              />
                              <span className="flex items-center justify-center w-5 h-5 mr-2 border border-gray-300 rounded-full box dark:border-gray-700">
                                <span
                                  className={`h-2 w-2 rounded-full bg-white ${
                                    eventLevel === key ? "block" : "hidden"
                                  }`}
                                ></span>
                              </span>
                            </span>
                            {key}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Fecha de inicio
                  </label>
                  <div className="relative">
                    <input
                      id="event-start-date"
                      type="date"
                      value={eventStartDate}
                      onChange={(e) => setEventStartDate(e.target.value)}
                      className="dark:bg-dark-900 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pl-4 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                    Fecha de fin
                  </label>
                  <div className="relative">
                    <input
                      id="event-end-date"
                      type="date"
                      value={eventEndDate}
                      onChange={(e) => setEventEndDate(e.target.value)}
                      className="dark:bg-dark-900 h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent bg-none px-4 py-2.5 pl-4 pr-11 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-6 modal-footer sm:justify-end">
                {selectedEvent && (
                  <button
                    onClick={handleDeleteEvent}
                    type="button"
                    className="mr-auto flex justify-center rounded-lg border border-error-300 px-4 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50 dark:border-error-500/40 dark:text-error-400 dark:hover:bg-error-500/10"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={closeModal}
                  type="button"
                  className="flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] sm:w-auto"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleAddOrUpdateEvent}
                  type="button"
                  className="btn btn-success btn-update-event flex w-full justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 sm:w-auto"
                >
                  {selectedEvent ? "Guardar cambios" : "Agregar evento"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </>
  );
};

const bordePorTipo: Record<string, string> = {
  Meta: "border-violet-500",
  Ingreso: "border-success-500",
  Pago: "border-error-500",
  Recordatorio: "border-warning-500",
};

const renderEventContent = (eventInfo: any) => {
  const { calendar, progreso, esReal } = eventInfo.event.extendedProps;
  const colorClass = `fc-bg-${calendar.toLowerCase()}`;
  const esMeta = calendar === "Meta";

  return (
    <div
      className={`event-fc-color flex flex-col gap-0.5 fc-event-main ${colorClass} p-1 rounded-md border-l-4 ${
        bordePorTipo[calendar] || "border-gray-400"
      } ${esReal ? "font-semibold" : ""}`}
    >
      <div className="flex items-center gap-1">
        <EventIcon calendar={calendar} className="h-3.5 w-3.5 shrink-0" />
        <div className="fc-event-time">{eventInfo.timeText}</div>
        <div className="fc-event-title truncate">{eventInfo.event.title}</div>
      </div>
      {esMeta && typeof progreso === "number" && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full bg-violet-500"
            style={{ width: `${Math.min(100, Math.max(0, progreso))}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default Calendar;
