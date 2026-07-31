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

const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8081/api';
const AI_BASE =
  import.meta.env.VITE_AI_URL ?? 'http://localhost:8000';

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
): Promise<AgentResponse> {
  const id = exigirUsuarioId(usuarioId);

  const response = await fetch(`${AI_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario_id: id,
      question,
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
): Promise<AnalisisResponse> {
  const id = exigirUsuarioId(usuarioId);

  console.log('Request enviado al análisis:', request);

  const response = await fetch(
    `${API_BASE}/analisis-financiero?usuarioId=${encodeURIComponent(id)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
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
  const response = await fetch(`${API_BASE}/usuarios`, {
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
): Promise<PerfilUsuario> {
  const id = exigirUsuarioId(usuarioId);

  const response = await fetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/perfil`,
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
): Promise<Transaccion[]> {
  const id = exigirUsuarioId(usuarioId);

  const response = await fetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/transacciones`,
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
): Promise<ResumenTransacciones> {
  const id = exigirUsuarioId(usuarioId);

  const response = await fetch(
    `${API_BASE}/usuarios/${encodeURIComponent(id)}/transacciones/resumen`,
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

  const response = await fetch(
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

  return response.json();
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
  const response = await fetch(
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
  const response = await fetch(
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
  const response = await fetch(
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
  const response = await fetch(
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
  const response = await fetch(
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