import {
  AnalisisRequest,
  PerfilUsuario,
  Transaccion,
} from '../types/finance';

const FRECUENCIAS_VALIDAS = [
  'Alta',
  'Media',
  'Baja',
  'Nunca',
];

/**
 * Arma el body de /analisis-financiero con el perfil
 * y los gastos reales del usuario.
 */
export function construirAnalisisRequest(
  perfil: PerfilUsuario,
  transacciones: Transaccion[],
): AnalisisRequest {
  return {
    ingresoMensual: perfil.ingresoMensual,
    nivelEndeudamiento: perfil.nivelEndeudamiento,
    frecuenciaAhorro: FRECUENCIAS_VALIDAS.includes(
      perfil.frecuenciaAhorro,
    )
      ? perfil.frecuenciaAhorro
      : 'Nunca',

    transacciones: transacciones
      .filter(
        (transaccion) =>
          transaccion.tipo?.toUpperCase() === 'GASTO' &&
          transaccion.monto > 0,
      )
      .map((transaccion) => ({
  descripcion: transaccion.descripcion,
  valor: transaccion.monto,
  fecha: transaccion.fecha,
})),
  };
}