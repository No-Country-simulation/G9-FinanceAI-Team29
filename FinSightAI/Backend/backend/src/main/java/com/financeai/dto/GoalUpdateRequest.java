package com.financeai.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record GoalUpdateRequest(
    @Size(min = 1, max = 100) String nombre,
    @Size(max = 255) String descripcion,
    String categoria,
    @DecimalMin(value = "0.01") BigDecimal montoObjetivo,
    LocalDate fechaObjetivo
) {}
