package com.financeai.dto;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regresión del bug del 500: los DTOs (records) toleran valores null, a diferencia
 * de {@code Map.of(...)} que lanzaba NullPointerException con un email null.
 */
class DtoNullToleranceTest {

    @Test
    void perfilActualizado_aceptaEmailNull() {
        // Antes esto se hacía con Map.of("email", null) → NullPointerException.
        PerfilActualizadoResponse res =
            new PerfilActualizadoResponse("Perfil actualizado correctamente.", "Ana", "Pérez", null);

        assertThat(res.email()).isNull();
        assertThat(res.nombre()).isEqualTo("Ana");
        assertThat(res.apellido()).isEqualTo("Pérez");
        assertThat(res.mensaje()).isEqualTo("Perfil actualizado correctamente.");
    }

    @Test
    void resumenTransacciones_seConstruyeConValores() {
        ResumenTransaccionesDTO res = new ResumenTransaccionesDTO(
            new BigDecimal("526.01"),
            new BigDecimal("3307.72"),
            Map.of("Transporte", new BigDecimal("120.00")),
            5
        );

        assertThat(res.totalGastos()).isEqualByComparingTo("526.01");
        assertThat(res.totalIngresos()).isEqualByComparingTo("3307.72");
        assertThat(res.porCategoria()).containsEntry("Transporte", new BigDecimal("120.00"));
        assertThat(res.cantidadTransacciones()).isEqualTo(5);
    }
}
