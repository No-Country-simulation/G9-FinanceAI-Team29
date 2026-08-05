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
  fecha: string;
}

export interface RecomendacionFinanciera {
  id: string;
  tipo: string;
  perfil: 'Saludable' | 'En observación' | 'En riesgo' | string;
  prioridad: 'alta' | 'media' | 'sugerencia';
  titulo: string;
  diagnostico: string;
  accion: string;
  objetivo?: string | null;
  evidencia: Record<string, string | number>;
  preguntaFinsi: string;
  advertencia: string;
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
  recomendaciones: RecomendacionFinanciera[];
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
export type GoalCategory = 'COMPRA' | 'DEUDA' | 'AHORRO' | 'EMERGENCIA' | 'VIAJE' | 'OTRO';
export type GoalStatus = 'ACTIVA' | 'COMPLETADA' | 'CANCELADA';

export interface Goal {
  id: string;
  usuarioId: string;
  nombre: string;
  descripcion?: string | null;
  categoria: GoalCategory;
  montoObjetivo: number;
  montoReservado: number;
  montoRestante: number;
  progreso: number;
  fechaObjetivo?: string | null;
  reservaMensualSugerida?: number | null;
  estado: GoalStatus;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface GoalInput {
  nombre: string;
  descripcion?: string;
  categoria: GoalCategory;
  montoObjetivo: number;
  fechaObjetivo?: string;
}
