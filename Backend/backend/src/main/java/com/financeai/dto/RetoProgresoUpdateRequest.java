package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;

public record RetoProgresoUpdateRequest(
    @NotBlank String semanaIso,
    boolean completado,
    String progreso
) {}
