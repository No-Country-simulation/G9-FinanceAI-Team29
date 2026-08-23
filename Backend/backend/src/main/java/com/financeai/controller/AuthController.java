package com.financeai.controller;

import com.financeai.dto.AuthChangePasswordRequest;
import com.financeai.dto.AuthConfirmRequest;
import com.financeai.dto.AuthForgotPasswordRequest;
import com.financeai.dto.AuthLoginRequest;
import com.financeai.dto.AuthRegisterRequest;
import com.financeai.dto.AuthResetPasswordRequest;
import com.financeai.exception.EmailNoConfirmadoException;
import com.financeai.model.Usuario;
import com.financeai.service.AuthService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Auth propio del backend (JWT firmado acá, no por Supabase).
 *
 * <p>Va en /api/auth/v2/* para convivir con el auth actual de Supabase (LoginController)
 * mientras se completa la migración. Al hacer el switch (paso 2.3) se unifica.
 */
@RestController
@RequestMapping("/api/auth/v2")
@Tag(name = "Auth (propio)", description = "Registro y login con JWT firmado por el backend")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> registrar(@Valid @RequestBody AuthRegisterRequest request) {
        try {
            Usuario usuario = authService.registrar(
                    request.email(), request.password(), request.nombre(), request.apellido());

            Map<String, Object> body = new HashMap<>();
            body.put("mensaje", "Cuenta creada. Te enviamos un correo para confirmar tu cuenta antes de ingresar.");
            body.put("usuarioId", usuario.getId());
            body.put("email", usuario.getEmail());
            body.put("requiereConfirmacion", true);
            return ResponseEntity.status(HttpStatus.CREATED).body(body);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("mensaje", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthLoginRequest request) {
        try {
            String token = authService.login(request.email(), request.password());
            return ResponseEntity.ok(Map.of("token", token));

        } catch (EmailNoConfirmadoException e) {
            // 403 + code: el front muestra el aviso y el botón de reenviar.
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("mensaje", e.getMessage(), "code", "EMAIL_NO_CONFIRMADO"));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", e.getMessage()));
        }
    }

    // Mismo mensaje exista o no el email: no filtramos qué correos están registrados.
    private static final String MENSAJE_RESET_GENERICO =
            "Si el correo existe en nuestro sistema, te enviamos un enlace para restablecer tu contraseña.";

    /** Solicitud de restablecimiento: genera un token y manda el email. Siempre responde 200. */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody AuthForgotPasswordRequest request) {
        try {
            authService.solicitarReset(request.email());
        } catch (Exception e) {
            // No filtramos el error real (podría revelar si el email existe o si falló el envío).
            // El log interno ya registra el detalle.
        }
        return ResponseEntity.ok(Map.of("mensaje", MENSAJE_RESET_GENERICO));
    }

    /** Fija la nueva contraseña usando el token que llegó por email. */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody AuthResetPasswordRequest request) {
        try {
            authService.resetearPassword(request.token(), request.password());
            return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada. Ya podés iniciar sesión."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    /** Confirma la cuenta con el token que llegó por email al registrarse. */
    @PostMapping("/confirm")
    public ResponseEntity<?> confirmar(@Valid @RequestBody AuthConfirmRequest request) {
        try {
            authService.confirmarEmail(request.token());
            return ResponseEntity.ok(Map.of("mensaje", "¡Cuenta confirmada! Ya podés iniciar sesión."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", e.getMessage()));
        }
    }

    // Mismo mensaje exista o no el email (y esté o no confirmada): no filtramos info.
    private static final String MENSAJE_CONFIRM_GENERICO =
            "Si el correo existe y está pendiente de confirmación, te reenviamos el enlace.";

    /** Reenvía el correo de confirmación de cuenta. Siempre responde 200. */
    @PostMapping("/resend-confirmation")
    public ResponseEntity<?> reenviarConfirmacion(@Valid @RequestBody AuthForgotPasswordRequest request) {
        try {
            authService.reenviarConfirmacion(request.email());
        } catch (Exception e) {
            // No filtramos el error real (podría revelar si el email existe). El log ya lo registra.
        }
        return ResponseEntity.ok(Map.of("mensaje", MENSAJE_CONFIRM_GENERICO));
    }

    /** Cambio de contraseña del usuario autenticado (el usuarioId sale del sub del token). */
    @PostMapping("/change-password")
    public ResponseEntity<?> cambiarPassword(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AuthChangePasswordRequest request) {

        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", "No autenticado."));
        }

        try {
            authService.cambiarPassword(
                    jwt.getSubject(), request.passwordActual(), request.passwordNueva());
            return ResponseEntity.ok(Map.of("mensaje", "Contraseña actualizada."));

        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", e.getMessage()));
        }
    }
}
