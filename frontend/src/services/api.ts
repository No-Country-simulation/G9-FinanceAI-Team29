import { AnalisisRequest, AnalisisResponse, Transaccion, PerfilUsuario, ResumenTransacciones } from '../types/finance';

const API_BASE = 'http://localhost:8081/api';

export async function analizarFinanzas(request: AnalisisRequest, usuarioId: string = 'USR0001'): Promise<AnalisisResponse> {
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
