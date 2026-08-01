package com.financeai.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class RegisterRequest {
    @NotBlank(message = "El nombre es obligatorio.")
    private String nombres;
    @NotBlank(message = "El apellido es obligatorio.")
    private String apellidos;
    @NotBlank(message = "El correo es obligatorio.")
    // Usa un patrón Regex estricto para asegurar un formato válido (ej. usuario@dominio.com)
    @Email(regexp = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", message = "El formato del correo electrónico no es válido.")
    private String email;
    @NotBlank(message = "La contraseña es obligatoria.")
    private String password;


    /**
     * Devuelve la unión de firstName y lastName.
     * @JsonIgnore evita que aparezca en la documentación de Swagger / JSON de entrada.
     */
    @JsonIgnore
    public String getDisplayName() {
        if (nombres == null && apellidos == null) return "";
        if (nombres == null) return apellidos.trim();
        if (apellidos == null) return nombres.trim();
        return (nombres.trim() + " " + apellidos.trim()).trim();
    }

    public String getPassword() {return password; }

    public void setPassword(String password) {this.password = password; }

    public String getEmail() { return email;   }

    public void setEmail(String email) {this.email = email;  }

    public String getNombres() {return nombres;  }

    public void setNombres(String nombres) {this.nombres = nombres; }

    public String getApellidos() { return apellidos;  }

    public void setApellidos(String apellidos) {this.apellidos = apellidos; }


}
