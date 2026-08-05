package com.financeai.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifica la Bean Validation de los DTOs (mejora A2).
 * No necesita el contexto de Spring ni la BD: valida los objetos directamente.
 */
class ValidationTest {

    private final Validator validator = buildValidator();

    private static Validator buildValidator() {
        ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
        return factory.getValidator();
    }

    private boolean violaEl(Set<? extends ConstraintViolation<?>> violaciones, String campo) {
        return violaciones.stream().anyMatch(v -> v.getPropertyPath().toString().equals(campo));
    }

    // ---- ProfileUpdateRequest ----

    @Test
    void perfilValido_noTieneViolaciones() {
        ProfileUpdateRequest req = new ProfileUpdateRequest();
        req.setNombre("Ana");
        req.setApellido("Pérez");
        req.setEmail("ana@example.com");

        assertThat(validator.validate(req)).isEmpty();
    }

    @Test
    void perfilRechazaNombreYApellidoEnBlanco() {
        ProfileUpdateRequest req = new ProfileUpdateRequest();
        req.setNombre("");
        req.setApellido("  ");

        Set<ConstraintViolation<ProfileUpdateRequest>> v = validator.validate(req);
        assertThat(violaEl(v, "nombre")).isTrue();
        assertThat(violaEl(v, "apellido")).isTrue();
    }

    @Test
    void perfilRechazaEmailConFormatoInvalido() {
        ProfileUpdateRequest req = new ProfileUpdateRequest();
        req.setNombre("Ana");
        req.setApellido("Pérez");
        req.setEmail("no-es-un-email");

        assertThat(violaEl(validator.validate(req), "email")).isTrue();
    }

    @Test
    void perfilPermiteEmailNull() {
        // El email es opcional (cuentas demo sin email real).
        ProfileUpdateRequest req = new ProfileUpdateRequest();
        req.setNombre("Ana");
        req.setApellido("Pérez");
        req.setEmail(null);

        assertThat(validator.validate(req)).isEmpty();
    }

    // ---- LoginUidRequest ----

    @Test
    void loginRechazaCamposEnBlanco() {
        LoginUidRequest req = new LoginUidRequest();
        req.setEmail("");
        req.setPassword("");

        Set<ConstraintViolation<LoginUidRequest>> v = validator.validate(req);
        assertThat(violaEl(v, "email")).isTrue();
        assertThat(violaEl(v, "password")).isTrue();
    }

    @Test
    void loginValido_noTieneViolaciones() {
        LoginUidRequest req = new LoginUidRequest();
        req.setEmail("demo@example.com");
        req.setPassword("7a5da953-cccf-4fec-a726-cbb9008400ab"); // auth_user_id

        assertThat(validator.validate(req)).isEmpty();
    }
}
