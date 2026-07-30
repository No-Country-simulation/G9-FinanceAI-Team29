package com.financeai.dto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record GoalResponse(
    String id, String usuarioId, String nombre, String descripcion, String categoria,
    BigDecimal montoObjetivo, BigDecimal montoReservado, BigDecimal montoRestante,
    BigDecimal progreso, LocalDate fechaObjetivo, BigDecimal reservaMensualSugerida,
    String estado, LocalDateTime fechaCreacion, LocalDateTime fechaActualizacion
) {}
