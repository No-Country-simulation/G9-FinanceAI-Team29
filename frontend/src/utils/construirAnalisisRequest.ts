import { AnalisisRequest, PerfilUsuario, Transaccion } from '../types/finance';

const FRECUENCIAS_VALIDAS = ['Alta', 'Media', 'Baja', 'Nunca'];

/** Arma el payload de /api/analisis-financiero a partir del perfil y las transacciones reales del usuario. */
export function construirAnalisisRequest(perfil: PerfilUsuario, transacciones: Transaccion[]): AnalisisRequest {
  return {
    ingresoMensual: perfil.ingresoMensual,
    nivelEndeudamiento: perfil.nivelEndeudamiento,
    frecuenciaAhorro: FRECUENCIAS_VALIDAS.includes(perfil.frecuenciaAhorro) ? perfil.frecuenciaAhorro : 'Nunca',
    transacciones: transacciones
      .filter(t => t.tipo === 'Gasto' && t.monto > 0)
      .map(t => ({ descripcion: t.descripcion, valor: t.monto })),
  };
}
