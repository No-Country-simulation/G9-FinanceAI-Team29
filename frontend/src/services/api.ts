import { AnalisisRequest, AnalisisResponse, Transaccion, PerfilUsuario, ResumenTransacciones } from '../types/finance';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';
const DEFAULT_USUARIO_ID = import.meta.env.VITE_USER_ID ?? 'USR0001';

export async function analizarFinanzas(request: AnalisisRequest, usuarioId: string = DEFAULT_USUARIO_ID): Promise<AnalisisResponse> {
  const response = await fetch(`${API_BASE}/analisis-financiero?usuarioId=${usuarioId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Error al analizar finanzas');
  return response.json();
}

export async function obtenerUsuario(usuarioId: string): Promise<PerfilUsuario> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/perfil`);
  if (!response.ok) throw new Error('Error al obtener usuario');
  return response.json();
}

export async function obtenerTransacciones(usuarioId: string): Promise<Transaccion[]> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/transacciones`);
  if (!response.ok) throw new Error('Error al obtener transacciones');
  return response.json();
}

export async function obtenerResumen(usuarioId: string): Promise<ResumenTransacciones> {
  const response = await fetch(`${API_BASE}/usuarios/${usuarioId}/transacciones/resumen`);
  if (!response.ok) throw new Error('Error al obtener resumen');
  return response.json();
}
