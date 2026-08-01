package com.financeai.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalCreateRequest(
    @NotBlank @Size(max = 100) String nombre,
    @Size(max = 255) String descripcion,
    @NotBlank String categoria,
    @NotNull @DecimalMin(value = "0.01") BigDecimal montoObjetivo,
    LocalDate fechaObjetivo
) {}
