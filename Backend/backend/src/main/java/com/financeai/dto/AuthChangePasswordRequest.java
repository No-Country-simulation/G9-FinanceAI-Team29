package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Body de POST /api/auth/v2/change-password (requiere token; el usuario sale del JWT). */
public record AuthChangePasswordRequest(

    @NotBlank(message = "La contraseña actual es obligatoria.")
    String passwordActual,

    @NotBlank(message = "La nueva contraseña es obligatoria.")
    @Size(min = 8, max = 72, message = "La nueva contraseña debe tener entre 8 y 72 caracteres.")
    String passwordNueva
) {}
