package com.financeai.dto;

import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record EventoCalendarioUpdateRequest(
    @Size(min = 1, max = 255) String titulo,
    String tipo,
    LocalDate fechaInicio,
    LocalDate fechaFin
) {}
