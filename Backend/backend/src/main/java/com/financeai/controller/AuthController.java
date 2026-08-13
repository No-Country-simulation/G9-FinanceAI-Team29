package com.financeai.controller;

import com.financeai.dto.AuthChangePasswordRequest;
import com.financeai.dto.AuthLoginRequest;
import com.financeai.dto.AuthRegisterRequest;
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
            body.put("mensaje", "Cuenta creada correctamente.");
            body.put("usuarioId", usuario.getId());
            body.put("email", usuario.getEmail());
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

        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", e.getMessage()));
        }
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
