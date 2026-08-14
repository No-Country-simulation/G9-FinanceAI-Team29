package com.financeai.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Body de POST /api/auth/v2/forgot-password. */
public record AuthForgotPasswordRequest(

    @NotBlank(message = "El email es obligatorio.")
    @Email(message = "El email no tiene un formato válido.")
    String email
) {}
