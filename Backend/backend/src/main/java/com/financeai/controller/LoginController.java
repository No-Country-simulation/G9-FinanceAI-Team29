package com.financeai.controller;

import com.financeai.dto.LoginUidRequest;
import com.financeai.dto.RegisterRequest;
import com.financeai.model.EstadoUsuario;
import com.financeai.model.Usuario;
import com.financeai.repository.UsuarioRepository;
import com.financeai.service.SupabaseAuthService;
import com.financeai.service.UsuarioService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth") // ← Un endpoint más semántico para autenticación

public class LoginController {

    private final UsuarioRepository usuarioRepository;
    @Autowired
    private SupabaseAuthService supabaseAuthService;
    // Inyección por constructor
    public LoginController(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginConUid(@Valid @RequestBody LoginUidRequest request) {
        try {
            // 1. Validar las credenciales (Email + Password) contra Supabase Auth API
            // El servicio intenta hacer login en Supabase y te devuelve el UID (authUserId)
            String authUserId = supabaseAuthService.autenticarYObtenerUid(request.getEmail(), request.getPassword());
            if (authUserId == null || authUserId.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("mensaje", "Credenciales inválidas: Email o contraseña incorrectos."));
            }
            // 2. Buscar los datos en la tabla public.usuarios usando el authUserId recuperado
            return usuarioRepository.findByAuthUserId(authUserId)
                .map(usuario -> {
                    EstadoUsuario estado = usuario.getEstado();

                    if (estado == EstadoUsuario.ELIMINADO) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(Map.of("mensaje", "Esta cuenta fue dada de baja. Contactá con soporte para solicitar su recuperación."));
                    }

                    // Una cuenta inactiva se reactiva automáticamente cuando el usuario vuelve.
                    if (estado == EstadoUsuario.INACTIVO) {
                        usuario.setEstado(EstadoUsuario.ACTIVO);
                    }
                    usuario.setUltimaActividad(LocalDateTime.now());
                    usuarioRepository.save(usuario);

                    Map<String, Object> respuesta = new HashMap<>();
                    respuesta.put("mensaje", "Autenticación exitosa");
                    respuesta.put("id", usuario.getId());
                    respuesta.put("authUserId", usuario.getAuthUserId());
                    respuesta.put("ingresoMensual", usuario.getIngresoMensual());
                    respuesta.put("deudaMensual", usuario.getDeudaMensual());
                    respuesta.put("perfilFinanciero", usuario.getPerfilFinanciero());
                    respuesta.put("estado", usuario.getEstado().name());
                    return ResponseEntity.ok(respuesta);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "Usuario no encontrado en la base de datos local.")));

        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", "Error de autenticación: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("mensaje", "Ocurrió un error inesperado al procesar el inicio de sesión."));
        }
    }

    @Autowired
    private UsuarioService usuarioService;

    /**
     * POST /api/auth/registro
     * Registra al usuario tanto en Supabase Auth como en la tabla local usuarios.
     */
    @PostMapping("/registro")
    public ResponseEntity<?> registrarUsuario(@Valid @RequestBody RegisterRequest request) {
        try {
            // El servicio se encarga de crear en Supabase Auth y luego en PostgreSQL
            Usuario usuarioCreado = usuarioService.registrarNuevoUsuario(request);

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(usuarioCreado);

        } catch (RuntimeException e) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Ocurrió un error interno al procesar el registro.");
        }
    }
}
