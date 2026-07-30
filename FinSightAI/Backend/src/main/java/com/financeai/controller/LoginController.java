package com.financeai.controller;

import com.financeai.dto.LoginUidRequest;
import com.financeai.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth") // ← Un endpoint más semántico para autenticación
@CrossOrigin(origins = "*")
public class LoginController {

    private final UsuarioRepository usuarioRepository;

    // Inyección por constructor
    public LoginController(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginConUid(@RequestBody LoginUidRequest request) {
        // 1. Validar que la combinación Email + UID exista en Supabase Auth
        boolean esValido = usuarioRepository.existeEnAuthSupabase(request.getEmail(), request.getUid());

        if (!esValido) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", "Credenciales inválidas: No coinciden Email y UID en Supabase."));
        }

        // 2. Si es válido, traer los datos de la tabla public.usuarios usando el authUserId
        return usuarioRepository.findByAuthUserId(request.getUid())
                .map(usuario -> {
                    Map<String, Object> respuesta = new HashMap<>();
                    respuesta.put("mensaje", "Autenticación exitosa");
                    respuesta.put("id", usuario.getId());
                    respuesta.put("authUserId", usuario.getAuthUserId());
                    respuesta.put("ingresoMensual", usuario.getIngresoMensual());
                    respuesta.put("deudaMensual", usuario.getDeudaMensual());
                    respuesta.put("perfilFinanciero", usuario.getPerfilFinanciero());
                    return ResponseEntity.ok(respuesta);
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "El usuario está autenticado pero no tiene perfil financiero registrado.")));
    }
}
