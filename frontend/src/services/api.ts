import {
  AnalisisRequest,
  AnalisisResponse,
  Transaccion,
  PerfilUsuario,
  ResumenTransacciones,
  Goal,
  GoalInput,
} from '../types/finance';
import { NotFoundError } from './errors';
import { supabase } from './supabase';

const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8081/api';
const AI_BASE =
  import.meta.env.VITE_AI_URL ?? 'http://localhost:8000';

/**
 * fetch para el backend: adjunta el JWT de Supabase (Authorization: Bearer)
 * cuando hay sesión activa. Un único lugar → todas las llamadas al backend
 * quedan autenticadas sin repetir código en cada función.
 */
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const conAuth = (token?: string): RequestInit => {
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return { ...init, headers };
  };

  const { data } = await supabase.auth.getSession();
  let response = await fetch(url, conAuth(data.session?.access_token));

  // Si el token venció o estaba refrescándose (401 transitorio al iniciar sesión),
  // lo renovamos y reintentamos UNA vez antes de dar el error al usuario.
  if (response.status === 401) {
    const { data: renovada } = await supabase.auth.refreshSession();
    const token = renovada.session?.access_token;
    if (token) {
      response = await fetch(url, conAuth(token));
    }
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

export interface CrearUsuarioRequest {
  nombre: string;
  apellido: string;
  email: string;
  authUserId: string;
}

export interface CrearUsuarioResponse {
  mensaje: string;
  usuarioId: string;
  nombre: string;
  apellido: string;
  email: string;
  authUserId: string;
}

// AI-Service (FastAPI :8000) — agente LLM.
// POST /agent/chat { usuario_id, question }
export async function preguntarAgente(
  question: string,
  usuarioId: string,
  previousAnswer?: string,
): Promise<AgentResponse> {
  const id = exigirUsuarioId(usuarioId);

  const response = await fetch(`${AI_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario_id: id,
      question,
      previous_answer: previousAnswer,
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

export async function crearUsuario(
  request: CrearUsuarioRequest,
): Promise<CrearUsuarioResponse> {
  const response = await apiFetch(`${API_BASE}/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const raw = await response.text();
    let mensaje = 'No se pudo crear el perfil del usuario.';

    try {
      const data = JSON.parse(raw);
      mensaje =
        data.mensaje ??
        data.message ??
        data.error ??
        mensaje;
    } catch {
      if (raw) {
        mensaje = raw;
      }
    }

    throw new Error(mensaje);
  }

  const data: CrearUsuarioResponse = await response.json();

  if (!data.usuarioId) {
    throw new Error(
      'El backend creó el perfil, pero no devolvió usuarioId.',
    );
  }

  return data;
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
