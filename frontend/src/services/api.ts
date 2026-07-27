import { AnalisisRequest, AnalisisResponse, Transaccion, PerfilUsuario, ResumenTransacciones, Goal, GoalInput } from '../types/finance';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8081/api';
const AI_BASE = import.meta.env.VITE_AI_URL ?? 'http://localhost:8000';
const DEFAULT_USUARIO_ID = import.meta.env.VITE_USER_ID ?? 'USR0001';

export interface AgentResponse {
  answer: string;
  provider: string;
}

// AI-Service (FastAPI :8000) — agente LLM. POST /agent/chat { usuario_id, question }
export async function preguntarAgente(
  question: string,
  usuarioId: string = DEFAULT_USUARIO_ID,
): Promise<AgentResponse> {
  const response = await fetch(`${AI_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: usuarioId, question }),
  });
  if (!response.ok) throw new Error('Error al consultar el asistente IA');
  return response.json();
}

export async function analizarFinanzas(
  request: AnalisisRequest,
  usuarioId: string = DEFAULT_USUARIO_ID,
): Promise<AnalisisResponse> {
  console.log('Request enviado al análisis:', request);

  const response = await fetch(
    `${API_BASE}/analisis-financiero?usuarioId=${usuarioId}`,
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

export async function obtenerUsuario(usuarioId: string): Promise<PerfilUsuario> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/perfil`);
  if (!response.ok) throw new Error('Error al obtener usuario');
  return response.json();
}

// En la BD el tipo viene en MAYÚSCULAS ("GASTO"/"INGRESO") y el front lo muestra
// como "Gasto"/"Ingreso", así que lo pasamos aquí de una vez.
function normalizarTipo(tipo: string): string {
  const t = (tipo ?? '').toUpperCase();
  if (t === 'GASTO') return 'Gasto';
  if (t === 'INGRESO') return 'Ingreso';
  return tipo;
}

export async function obtenerTransacciones(usuarioId: string): Promise<Transaccion[]> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/transacciones`);
  if (!response.ok) throw new Error('Error al obtener transacciones');
  const data: Transaccion[] = await response.json();
  return data.map((t) => ({ ...t, tipo: normalizarTipo(t.tipo) }));
}

export async function obtenerResumen(usuarioId: string): Promise<ResumenTransacciones> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/transacciones/resumen`);
  if (!response.ok) throw new Error('Error al obtener resumen');
  return response.json();
}


async function parseApiError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.message || data.detail || data.error || 'Error inesperado';
  } catch {
    return await response.text() || 'Error inesperado';
  }
}

export async function obtenerMetas(usuarioId: string): Promise<Goal[]> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/metas`);
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function crearMeta(data: GoalInput, usuarioId: string): Promise<Goal> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/metas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function actualizarMeta(goalId: string, data: Partial<GoalInput>, usuarioId: string): Promise<Goal> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/metas/${goalId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function agregarAhorroMeta(goalId: string, monto: number, usuarioId: string): Promise<Goal> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/metas/${goalId}/aportes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}

export async function cancelarMeta(goalId: string, usuarioId: string): Promise<Goal> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/metas/${goalId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json();
}
