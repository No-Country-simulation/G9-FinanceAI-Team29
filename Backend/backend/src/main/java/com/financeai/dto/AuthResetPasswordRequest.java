package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body de POST /api/auth/v2/reset-password (token que llegó por email + nueva contraseña). */
public record AuthResetPasswordRequest(

    @NotBlank(message = "El token es obligatorio.")
    String token,

    @NotBlank(message = "La nueva contraseña es obligatoria.")
    @Size(min = 8, max = 72, message = "La nueva contraseña debe tener entre 8 y 72 caracteres.")
    String password
) {}
