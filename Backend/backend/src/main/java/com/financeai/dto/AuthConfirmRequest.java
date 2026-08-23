package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;

/** Body de POST /api/auth/v2/confirm (token de confirmación que llegó por email). */
public record AuthConfirmRequest(

    @NotBlank(message = "El token es obligatorio.")
    String token
) {}
