package com.financeai.dto;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Respuesta de GET /api/usuarios/{id}/transacciones/resumen.
 *
 * Tipada (no un {@code Map<String, Object>} opaco) para que sea clara y quede
 * auto-documentada en Swagger. Los nombres de los campos se mantienen iguales a
 * los del Map anterior para no romper el frontend.
 *
 * @param totalGastos           suma de los gastos
 * @param totalIngresos         suma de los ingresos
 * @param porCategoria          gasto acumulado por categoría
 * @param cantidadTransacciones cantidad total de movimientos
 */
public record ResumenTransaccionesDTO(
    BigDecimal totalGastos,
    BigDecimal totalIngresos,
    Map<String, BigDecimal> porCategoria,
    int cantidadTransacciones
) {}
