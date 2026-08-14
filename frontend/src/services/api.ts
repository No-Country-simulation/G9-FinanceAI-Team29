import {
  AnalisisRequest,
  AnalisisResponse,
  Transaccion,
  PerfilUsuario,
  ResumenTransacciones,
  Goal,
  GoalInput,
  EventoCalendario,
  EventoCalendarioInput,
} from '../types/finance';
import { NotFoundError } from './errors';
import { getToken } from './authSession';

const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8081/api';
const AI_BASE =
  import.meta.env.VITE_AI_URL ?? 'http://localhost:8000';

/**
 * fetch para el backend: adjunta NUESTRO JWT (Authorization: Bearer) cuando hay
 * sesión activa. Un único lugar → todas las llamadas al backend quedan
 * autenticadas sin repetir código en cada función.
 *
 * Red de seguridad: ante un error transitorio (típico justo después del login,
 * mientras la sesión se propaga, o con el backend recién levantado) re-leemos el
 * token y reintentamos UNA vez. Cubre el 401 (token propagándose) y el 502/503/504
 * (backend/proxy arrancando). Solo en métodos idempotentes (GET/PUT/DELETE) para no
 * duplicar escrituras — un POST nunca se reintenta.
 */
const ESTADOS_REINTENTABLES = new Set([401, 502, 503, 504]);

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const construir = (): RequestInit => {
    const headers = new Headers(init.headers);
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return { ...init, headers };
  };

  let response = await fetch(url, construir());

  const metodo = (init.method ?? 'GET').toUpperCase();
  const esIdempotente =
    metodo === 'GET' || metodo === 'PUT' || metodo === 'DELETE';

  if (esIdempotente && ESTADOS_REINTENTABLES.has(response.status)) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    response = await fetch(url, construir());
  }

  return response;
}

function exigirUsuarioId(usuarioId: string): string {
  const idLimpio = usuarioId?.trim();

  if (!idLimpio) {
    throw new Error(
      'No hay un usuario asociado a la sesión. Creá o recuperá primero el perfil del usuario.',
    );
  }

  return idLimpio;
}

export interface AgentResponse {
  answer: string;
  provider: string;
}

// AI-Service (FastAPI :8000) — agente LLM.
// POST /agent/chat { usuario_id, question }
export async function preguntarAgente(
  question: string,
  usuarioId: string,
  previousAnswer?: string,
  assistantMode?: string,
): Promise<AgentResponse> {
  const id = exigirUsuarioId(usuarioId);

  const response = await fetch(`${AI_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario_id: id,
      question,
      previous_answer: previousAnswer,
      assistant_mode: assistantMode,
    }),
  });

  if (!response.ok) {
    const detalle = await response.text();

    throw new Error(
      detalle || 'Error al consultar el asistente IA.',
    );
  }

  return response.json();
}

// Variante con streaming de estado (SSE) — usada como ejemplo para narrar
// pasos tipo "Finsi está analizando tus gastos..." mientras se procesa la
// pregunta (hoy solo el AI-Service narra pasos para "resumen financiero";
// el resto de las preguntas llega directo con un único evento "done").
export async function preguntarAgenteStream(
  question: string,
  usuarioId: string,
  previousAnswer: string | undefined,
  onStep: (mensaje: string) => void,
  assistantMode?: string,
): Promise<AgentResponse> {
  const id = exigirUsuarioId(usuarioId);

  const response = await fetch(`${AI_BASE}/agent/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario_id: id,
      question,
      previous_answer: previousAnswer,
      assistant_mode: assistantMode,
    }),
  });

  if (!response.ok || !response.body) {
    const detalle = await response.text().catch(() => '');
    throw new Error(detalle || 'Error al consultar el asistente IA.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const eventos = buffer.split('\n\n');
    buffer = eventos.pop() ?? '';

    for (const bloque of eventos) {
      const linea = bloque.split('\n').find((l) => l.startsWith('data: '));
      if (!linea) continue;
      const evento = JSON.parse(linea.slice('data: '.length));

      if (evento.status === 'step') {
        onStep(evento.message);
      } else if (evento.status === 'done') {
        return { answer: evento.answer, provider: evento.provider };
      } else if (evento.status === 'error') {
        throw new Error(evento.message || 'Error al consultar el asistente IA.');
      }
    }
  }

  throw new Error('El asistente IA cerró la conexión sin responder.');
}

export async function analizarFinanzas(
  request: AnalisisRequest,
  usuarioId: string,
  signal?: AbortSignal,
): Promise<AnalisisResponse> {
  const id = exigirUsuarioId(usuarioId);

  console.log('Request enviado al análisis:', request);

  const response = await apiFetch(
    `${API_BASE}/analisis-financiero?usuarioId=${encodeURIComponent(id)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    },
  );

  if (!response.ok) {
    const detalle = await response.text();

    console.error(
      'Error del backend al analizar:',
      response.status,
      detalle,
    );

    throw new Error(
      `Error al analizar finanzas (${response.status}): ${detalle}`,
    );
  }

  return response.json();
}

export async function obtenerUsuario(
  usuarioId: string,
  signal?: AbortSignal,
): Promise<PerfilUsuario> {
  const id = exigirUsuarioId(usuarioId);

  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/perfil`,
    { signal },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('El usuario solicitado no existe.');
    }
    throw new Error('Error al obtener usuario');
  }

  return response.json();
}

// En la BD el tipo viene en MAYÚSCULAS ("GASTO"/"INGRESO") y el front
// lo muestra como "Gasto"/"Ingreso".
function normalizarTipo(tipo: string): string {
  const t = (tipo ?? '').toUpperCase();

  if (t === 'GASTO') return 'Gasto';
  if (t === 'INGRESO') return 'Ingreso';

  return tipo;
}

export async function obtenerTransacciones(
  usuarioId: string,
  signal?: AbortSignal,
): Promise<Transaccion[]> {
  const id = exigirUsuarioId(usuarioId);

  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/transacciones`,
    { signal },
  );

  if (!response.ok) {
    throw new Error('Error al obtener transacciones');
  }

  const data: Transaccion[] = await response.json();

  return data.map((transaccion) => ({
    ...transaccion,
    tipo: normalizarTipo(transaccion.tipo),
  }));
}

export async function obtenerResumen(
  usuarioId: string,
  signal?: AbortSignal,
): Promise<ResumenTransacciones> {
  const id = exigirUsuarioId(usuarioId);

  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/transacciones/resumen`,
    { signal },
  );

  if (!response.ok) {
    throw new Error('Error al obtener resumen');
  }

  return response.json();
}

export interface ImportacionCsvResponse {
  mensaje: string;
  usuarioId: string;
  perfilFinanciero: string;
  movimientosGuardados?: number;
  resumen: {
    cantidadTransacciones: number;
    cantidadMeses: number;
    totalIngresos: number;
    totalGastos: number;
    moneda: 'USD';
  };
}

export async function importarCsv(
  usuarioId: string,
  archivo: File,
): Promise<ImportacionCsvResponse> {
  const id = exigirUsuarioId(usuarioId);
  const formData = new FormData();

  formData.append('archivo', archivo);

  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/importar-csv`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!response.ok) {
    const raw = await response.text();
    let mensaje = 'No se pudo importar el CSV.';

    try {
      const data = JSON.parse(raw);
      mensaje =
        data.message ??
        data.error ??
        data.detail?.errores?.join(' ') ??
        mensaje;
    } catch {
      if (raw) {
        mensaje = raw;
      }
    }

    throw new Error(mensaje);
  }

  const rawData = await response.json();
  const rawResumen = rawData?.resumen ?? {};

  return {
    mensaje: rawData?.mensaje ?? 'CSV importado correctamente',
    usuarioId: rawData?.usuarioId ?? rawData?.usuario_id ?? id,
    perfilFinanciero:
      rawData?.perfilFinanciero ?? rawData?.perfil_financiero ?? 'Sin determinar',
    movimientosGuardados:
      rawData?.movimientosGuardados ?? rawData?.movimientos_guardados,
    resumen: {
      cantidadTransacciones:
        rawResumen?.cantidadTransacciones ??
        rawResumen?.cantidad_transacciones ??
        rawData?.movimientosGuardados ??
        rawData?.movimientos_guardados ??
        0,
      cantidadMeses:
        rawResumen?.cantidadMeses ?? rawResumen?.cantidad_meses ?? 0,
      totalIngresos:
        rawResumen?.totalIngresos ?? rawResumen?.total_ingresos ?? 0,
      totalGastos:
        rawResumen?.totalGastos ?? rawResumen?.total_gastos ?? 0,
      moneda: rawResumen?.moneda ?? 'USD',
    },
  };
}

async function parseApiError(response: Response): Promise<string> {
  const raw = await response.text();

  if (!raw) {
    return 'Error inesperado';
  }

  try {
    const data = JSON.parse(raw);

    if (typeof data.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data.detail?.errores)) {
      return data.detail.errores.join(' ');
    }

    return data.mensaje ?? data.message ?? data.error ?? raw;
  } catch {
    return raw;
  }
}

export async function obtenerMetas(usuarioId: string): Promise<Goal[]> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/metas`,
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function crearMeta(
  data: GoalInput,
  usuarioId: string,
): Promise<Goal> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/metas`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function actualizarMeta(
  goalId: string,
  data: Partial<GoalInput>,
  usuarioId: string,
): Promise<Goal> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/metas/${encodeURIComponent(goalId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('La meta solicitada no existe.');
    }
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function agregarAhorroMeta(
  goalId: string,
  monto: number,
  usuarioId: string,
): Promise<Goal> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/metas/${encodeURIComponent(goalId)}/aportes`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto }),
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('La meta solicitada no existe.');
    }
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function cancelarMeta(
  goalId: string,
  usuarioId: string,
): Promise<Goal> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/metas/${encodeURIComponent(goalId)}`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('La meta solicitada no existe.');
    }
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function obtenerEventosCalendario(
  usuarioId: string,
): Promise<EventoCalendario[]> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/eventos-calendario`,
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function crearEventoCalendario(
  data: EventoCalendarioInput,
  usuarioId: string,
): Promise<EventoCalendario> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/eventos-calendario`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function actualizarEventoCalendario(
  eventoId: string,
  data: Partial<EventoCalendarioInput>,
  usuarioId: string,
): Promise<EventoCalendario> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/eventos-calendario/${encodeURIComponent(eventoId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('El evento solicitado no existe.');
    }
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function eliminarEventoCalendario(
  eventoId: string,
  usuarioId: string,
): Promise<void> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/eventos-calendario/${encodeURIComponent(eventoId)}`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new NotFoundError('El evento solicitado no existe.');
    }
    throw new Error(await parseApiError(response));
  }
}

/** Devuelve el token secreto (generándolo si es la primera vez) que identifica
 * el feed .ics del usuario logueado. Llama a una función serverless de Vercel
 * (mismo origen), no al backend Java. */
export async function obtenerTokenCalendario(): Promise<string> {
  const response = await apiFetch('/api/calendario-token');
  if (!response.ok) {
    throw new Error('No se pudo generar el enlace de suscripción al calendario.');
  }
  const data = await response.json();
  return data.token;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function suscribirNotificacionesPush(subscription: PushSubscriptionInput): Promise<void> {
  const response = await apiFetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    throw new Error('No se pudo activar las notificaciones push.');
  }
}

export async function cancelarNotificacionesPush(endpoint: string): Promise<void> {
  const response = await apiFetch('/api/push-unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) {
    throw new Error('No se pudo desactivar las notificaciones push.');
  }
}

export interface PerfilCompleto {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  email?: string | null;
  ingresoMensual?: number | null;
  deudaMensual?: number | null;
  nivelEndeudamiento?: number | null;
  gastoMensualPromedio?: number | null;
  ahorroMensualEstimado?: number | null;
  porcentajeGastosIngreso?: number | null;
  frecuenciaAhorro?: string | null;
  perfilFinanciero?: string | null;
  activo?: boolean | null;
  estado?: 'ACTIVO' | 'INACTIVO' | 'ELIMINADO' | null;
  ultimaActividad?: string | null;
  fechaEliminacion?: string | null;
}

export async function obtenerPerfilCompleto(
  usuarioId: string,
): Promise<PerfilCompleto> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(`${API_BASE}/usuarios/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error('No se pudo cargar el perfil.');
  }

  return response.json();
}

export async function actualizarPerfil(
  usuarioId: string,
  datos: { nombre: string; apellido: string; email?: string },
): Promise<void> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/perfil`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    },
  );

  if (!response.ok) {
    const detalle = await response.text();
    throw new Error(detalle || 'No se pudo actualizar el perfil.');
  }
}

/**
 * Cambia la contraseña del usuario autenticado. El backend verifica la actual
 * (el usuarioId sale del token, no se envía).
 */
export async function cambiarPassword(
  passwordActual: string,
  passwordNueva: string,
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/auth/v2/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordActual, passwordNueva }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.mensaje ?? 'No se pudo cambiar la contraseña.');
  }
}

// --- Gamificación (retos, trivia, logros) persistidos en Supabase ---

export interface RetoProgresoDTO {
  retoId: string;
  semanaIso: string;
  completado: boolean;
  progreso: string | null;
  actualizadoAt: string;
}

export interface LogroDTO {
  logroId: string;
  desbloqueadoAt: string;
}

export interface TriviaRespuestaDTO {
  preguntaId: string;
  correcta: boolean;
}

export async function guardarRetoProgreso(
  usuarioId: string,
  retoId: string,
  semanaIso: string,
  completado: boolean,
  progreso: string | null,
): Promise<RetoProgresoDTO> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/gamificacion/retos/${encodeURIComponent(retoId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semanaIso, completado, progreso }),
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function obtenerLogrosDesbloqueados(usuarioId: string): Promise<LogroDTO[]> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(`${API_BASE}/usuarios/${encodeURIComponent(id)}/gamificacion/logros`);

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function desbloquearLogroRemoto(usuarioId: string, logroId: string): Promise<LogroDTO> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/gamificacion/logros/${encodeURIComponent(logroId)}`,
    { method: 'POST' },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function registrarResultadosTrivia(
  usuarioId: string,
  respuestas: TriviaRespuestaDTO[],
): Promise<void> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/gamificacion/trivia`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuestas }),
    },
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export interface TriviaEstadisticasDTO {
  bestScore: number;
  correctStreak: number;
  lastPlayedDate: string | null;
  canPlayToday: boolean;
}

export async function obtenerEstadisticasTrivia(usuarioId: string): Promise<TriviaEstadisticasDTO> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/gamificacion/trivia/estadisticas`,
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export interface EstadoGamificacionDTO {
  weekKey: string;
  challengesBaseline: string | null;
  streak: number;
  bestStreak: number;
  lastActiveDate: string | null;
  dailyStreak: number;
  bestDailyStreak: number;
  bestLevelSeen: number;
  ultimaSubidaNivel: string | null;
  puntos: number;
}

export async function obtenerEstadoGamificacion(usuarioId: string): Promise<EstadoGamificacionDTO | null> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(`${API_BASE}/usuarios/${encodeURIComponent(id)}/gamificacion/estado`);

  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function guardarEstadoGamificacion(
  usuarioId: string,
  estado: EstadoGamificacionDTO,
): Promise<EstadoGamificacionDTO> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(`${API_BASE}/usuarios/${encodeURIComponent(id)}/gamificacion/estado`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(estado),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function darDeBajaCuenta(usuarioId: string): Promise<void> {
  const id = exigirUsuarioId(usuarioId);
  const response = await apiFetch(`${API_BASE}/usuarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const detalle = await response.text();
    throw new Error(detalle || 'No se pudo dar de baja la cuenta.');
  }
}

export interface ReclasificacionResponse {
  usuarioId: string;
  transaccionesTotales: number;
  gastosProcesados: number;
  actualizadas: number;
  omitidas: number;
  errores: number;
}

export async function reclasificarTransacciones(
  usuarioId: string,
): Promise<ReclasificacionResponse> {
  const id = exigirUsuarioId(usuarioId);

  const response = await apiFetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/reclasificar`,
    {
      method: 'POST',
    },
  );

  if (!response.ok) {
    const detalle = await response.text();

    throw new Error(
      detalle ||
        `No se pudieron reclasificar las transacciones (${response.status}).`,
    );
  }

  return response.json();
}