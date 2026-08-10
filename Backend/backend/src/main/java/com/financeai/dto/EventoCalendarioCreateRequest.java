package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record EventoCalendarioCreateRequest(
    @NotBlank @Size(max = 255) String titulo,
    @NotBlank String tipo,
    @NotNull LocalDate fechaInicio,
    LocalDate fechaFin
) {}
