package com.financeai.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EventoCalendarioResponse(
    String id,
    String usuarioId,
    String titulo,
    String tipo,
    LocalDate fechaInicio,
    LocalDate fechaFin,
    LocalDateTime fechaCreacion,
    LocalDateTime fechaActualizacion
) {}
