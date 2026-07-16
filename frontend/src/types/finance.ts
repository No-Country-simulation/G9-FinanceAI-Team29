export interface Usuario {
  id: string;
  ingresoMensual: number;
  deudaMensual: number;
  nivelEndeudamiento: number;
  gastoMensualPromedio: number;
  ahorroMensualEstimado: number;
  porcentajeGastosIngreso: number;
  frecuenciaAhorro: string;
  perfilFinanciero: string;
}

export interface Transaccion {
  id: string;
  descripcion: string;
  monto: number;
  categoria: string;
  fecha: string;
  tipo: string;
  medioPago: string;
  recurrente: boolean;
}

export interface AnalisisRequest {
  ingresoMensual: number;
  nivelEndeudamiento: number;
  frecuenciaAhorro: string;
  transacciones: TransaccionInput[];
}

export interface TransaccionInput {
  descripcion: string;
  valor: number;
}

export interface AnalisisResponse {
  perfilFinanciero: string;
  probabilidad: number;
  resumenGastos: {
    porCategoria: Record<string, number>;
    porcentajes: Record<string, number>;
  };
  totalGastos: number;
  totalIngresos: number;
  porcentajeAhorro: number;
  nivelRiesgo: string;
  recomendaciones: string[];
}

export interface PerfilUsuario {
  usuarioId: string;
  perfilFinanciero: string;
  nivelEndeudamiento: number;
  frecuenciaAhorro: string;
  ingresoMensual: number;
  ahorroEstimado: number;
}

export interface ResumenTransacciones {
  totalGastos: number;
  totalIngresos: number;
  porCategoria: Record<string, number>;
  cantidadTransacciones: number;
}
