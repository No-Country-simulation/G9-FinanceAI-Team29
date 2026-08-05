package com.financeai.controller;

import com.financeai.dto.PerfilActualizadoResponse;
import com.financeai.dto.ProfileUpdateRequest;
import jakarta.validation.Valid;
import com.financeai.model.Recomendacion;
import com.financeai.model.EstadoUsuario;
import com.financeai.model.Usuario;
import com.financeai.repository.RecomendacionRepository;
import com.financeai.repository.UsuarioRepository;
import com.financeai.service.SupabaseAuthService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Usuarios", description = "Perfil, datos y recomendaciones de usuarios")
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final RecomendacionRepository recomendacionRepository;
    private final SupabaseAuthService supabaseAuthService;

    public UsuarioController(
            UsuarioRepository usuarioRepository,
            RecomendacionRepository recomendacionRepository,
            SupabaseAuthService supabaseAuthService
    ) {
        this.usuarioRepository = usuarioRepository;
        this.recomendacionRepository = recomendacionRepository;
        this.supabaseAuthService = supabaseAuthService;
    }

    @PostMapping
    public synchronized ResponseEntity<?> crearUsuario(
            @RequestBody Usuario nuevoUsuario
    ) {
        String nombre = limpiar(nuevoUsuario.getNombre());
        String apellido = limpiar(nuevoUsuario.getApellido());
        String email = limpiar(nuevoUsuario.getEmail());
        String authUserId = limpiar(nuevoUsuario.getAuthUserId());

        if (nombre == null) {
            return badRequest("El nombre es obligatorio.");
        }

        if (apellido == null) {
            return badRequest("El apellido es obligatorio.");
        }

        if (email == null) {
            return badRequest("El email es obligatorio.");
        }

        if (authUserId == null) {
            return badRequest("El authUserId de Supabase es obligatorio.");
        }

        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                    Map.of("mensaje", "Ya existe un perfil con ese email.")
            );
        }

        if (usuarioRepository.existsByAuthUserId(authUserId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                    Map.of("mensaje", "Ese usuario de Supabase ya tiene un perfil.")
            );
        }

        /*
         * USR1001 será el primero si todavía no existe ningún ID USRxxxx.
         * Luego seguirá USR1002, USR1003, etc.
         */
        Integer maximoActual = usuarioRepository.obtenerMaximoNumeroUsuario();
        int siguienteNumero = (maximoActual == null ? 1000 : maximoActual) + 1;
        String nuevoId = String.format("USR%04d", siguienteNumero);

        nuevoUsuario.setId(nuevoId);
        nuevoUsuario.setNombre(nombre);
        nuevoUsuario.setApellido(apellido);
        nuevoUsuario.setEmail(email.toLowerCase());
        nuevoUsuario.setAuthUserId(authUserId);
        nuevoUsuario.setFechaRegistro(LocalDateTime.now());
        nuevoUsuario.setActivo(true);
        nuevoUsuario.setEstado(EstadoUsuario.ACTIVO);
        nuevoUsuario.setUltimaActividad(LocalDateTime.now());

        Usuario usuarioGuardado = usuarioRepository.save(nuevoUsuario);

        Map<String, Object> respuesta = new HashMap<>();
        respuesta.put("mensaje", "Usuario creado correctamente.");
        respuesta.put("usuarioId", usuarioGuardado.getId());
        respuesta.put("nombre", usuarioGuardado.getNombre());
        respuesta.put("apellido", usuarioGuardado.getApellido());
        respuesta.put("email", usuarioGuardado.getEmail());
        respuesta.put("authUserId", usuarioGuardado.getAuthUserId());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(respuesta);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Usuario> obtenerUsuario(@PathVariable String id) {
        return usuarioRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Devuelve el perfil del usuario AUTENTICADO, derivado del JWT de Supabase
     * (claim "sub" = authUserId). Reemplazo seguro de buscar por UUID en la URL:
     * acá el usuario no puede pedir el perfil de otro.
     */
    @GetMapping("/me")
    public ResponseEntity<?> obtenerMiPerfil(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("mensaje", "Falta el token de autenticación."));
        }
        String authUserId = jwt.getSubject();
        return usuarioRepository.findByAuthUserId(authUserId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("mensaje", "No hay un perfil asociado a esta cuenta.")));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Usuario> actualizarUsuario(
            @PathVariable String id,
            @RequestBody Usuario usuarioActualizado
    ) {
        return usuarioRepository.findById(id)
                .map(usuario -> {
                    if (usuarioActualizado.getNombre() != null) {
                        usuario.setNombre(usuarioActualizado.getNombre().trim());
                    }

                    if (usuarioActualizado.getApellido() != null) {
                        usuario.setApellido(usuarioActualizado.getApellido().trim());
                    }

                    if (usuarioActualizado.getEmail() != null) {
                        usuario.setEmail(usuarioActualizado.getEmail().trim().toLowerCase());
                    }

                    if (usuarioActualizado.getAuthUserId() != null) {
                        usuario.setAuthUserId(usuarioActualizado.getAuthUserId().trim());
                    }

                    usuario.setIngresoMensual(usuarioActualizado.getIngresoMensual());
                    usuario.setDeudaMensual(usuarioActualizado.getDeudaMensual());
                    usuario.setNivelEndeudamiento(usuarioActualizado.getNivelEndeudamiento());
                    usuario.setGastoMensualPromedio(
                            usuarioActualizado.getGastoMensualPromedio()
                    );
                    usuario.setAhorroMensualEstimado(
                            usuarioActualizado.getAhorroMensualEstimado()
                    );
                    usuario.setPorcentajeGastosIngreso(
                            usuarioActualizado.getPorcentajeGastosIngreso()
                    );
                    usuario.setFrecuenciaAhorro(
                            usuarioActualizado.getFrecuenciaAhorro()
                    );
                    usuario.setPerfilFinanciero(
                            usuarioActualizado.getPerfilFinanciero()
                    );

                    return ResponseEntity.ok(usuarioRepository.save(usuario));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/perfil")
    public ResponseEntity<?> actualizarPerfilBasico(
            @PathVariable String id,
            @Valid @RequestBody ProfileUpdateRequest request
    ) {
        return usuarioRepository.findById(id)
                .map(usuario -> {
                    String nombre = limpiar(request.getNombre());
                    String apellido = limpiar(request.getApellido());
                    String email = limpiar(request.getEmail());

                    if (nombre == null || apellido == null) {
                        return badRequest("Nombre y apellido son obligatorios.");
                    }

                    if (email != null && !email.equalsIgnoreCase(usuario.getEmail())) {
                        String emailNormalizado = email.toLowerCase();

                        if (usuarioRepository.existsByEmailIgnoreCase(emailNormalizado)) {
                            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                                    Map.of("mensaje", "Ya existe un perfil con ese email.")
                            );
                        }

                        try {
                            supabaseAuthService.actualizarEmailEnSupabase(usuario.getAuthUserId(), emailNormalizado);
                        } catch (RuntimeException e) {
                            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
                                    Map.of("mensaje", e.getMessage())
                            );
                        }

                        usuario.setEmail(emailNormalizado);
                    }

                    boolean nombreCambio = !nombre.equals(usuario.getNombre()) || !apellido.equals(usuario.getApellido());

                    if (nombreCambio) {
                        try {
                            supabaseAuthService.actualizarNombreEnSupabase(usuario.getAuthUserId(), nombre, apellido);
                        } catch (RuntimeException e) {
                            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
                                    Map.of("mensaje", e.getMessage())
                            );
                        }
                    }

                    usuario.setNombre(nombre);
                    usuario.setApellido(apellido);
                    usuarioRepository.save(usuario);

                    return ResponseEntity.ok(new PerfilActualizadoResponse(
                            "Perfil actualizado correctamente.",
                            nombre,
                            apellido,
                            usuario.getEmail()
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> darDeBaja(@PathVariable String id) {
        return usuarioRepository.findById(id)
                .map(usuario -> {
                    usuario.setEstado(EstadoUsuario.ELIMINADO);
                    usuario.setFechaEliminacion(LocalDateTime.now());
                    usuarioRepository.save(usuario);
                    return ResponseEntity.ok(Map.of(
                            "mensaje", "La cuenta fue dada de baja y sus datos fueron preservados.",
                            "estado", EstadoUsuario.ELIMINADO.name()
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/recomendaciones")
    public ResponseEntity<List<Recomendacion>> obtenerRecomendaciones(
            @PathVariable String id
    ) {
        List<Recomendacion> recomendaciones =
                recomendacionRepository.findByUsuarioIdAndActivaTrue(id);

        return ResponseEntity.ok(recomendaciones);
    }

    @GetMapping("/por-auth/{authUserId}")
    public ResponseEntity<?> obtenerPorAuthUserId(
            @PathVariable String authUserId
    ) {
        return usuarioRepository.findByAuthUserId(authUserId)
                .<ResponseEntity<?>>map(usuario -> {
                    // HashMap (no Map.of) porque el email puede ser null y Map.of no lo admite.
                    Map<String, Object> body = new HashMap<>();
                    body.put("usuarioId", usuario.getId());
                    body.put("authUserId", usuario.getAuthUserId());
                    body.put("email", usuario.getEmail());
                    return ResponseEntity.ok(body);
                })
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body(Map.of(
                                "mensaje",
                                "No existe un perfil asociado a ese usuario de Supabase."
                        )));
    }

    @GetMapping("/{id}/perfil")
    public ResponseEntity<Map<String, Object>> obtenerPerfil(
            @PathVariable String id
    ) {
        return usuarioRepository.findById(id)
                .map(usuario -> {
                    Map<String, Object> perfil = new HashMap<>();

                    perfil.put("usuarioId", usuario.getId());
                    perfil.put("nombre", usuario.getNombre());
                    perfil.put("apellido", usuario.getApellido());
                    perfil.put("email", usuario.getEmail());
                    perfil.put("estado", usuario.getEstado().name());
                    perfil.put("ultimaActividad", usuario.getUltimaActividad());
                    perfil.put("fechaEliminacion", usuario.getFechaEliminacion());

                    perfil.put(
                            "perfilFinanciero",
                            usuario.getPerfilFinanciero() != null
                                    ? usuario.getPerfilFinanciero()
                                    : "Sin clasificar"
                    );

                    perfil.put(
                            "nivelEndeudamiento",
                            usuario.getNivelEndeudamiento()
                    );

                    perfil.put(
                            "frecuenciaAhorro",
                            usuario.getFrecuenciaAhorro() != null
                                    ? usuario.getFrecuenciaAhorro()
                                    : "No definida"
                    );

                    perfil.put("ingresoMensual", usuario.getIngresoMensual());
                    perfil.put("ahorroEstimado", usuario.getAhorroMensualEstimado());

                    return ResponseEntity.ok(perfil);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private String limpiar(String valor) {
        if (valor == null || valor.trim().isEmpty()) {
            return null;
        }

        return valor.trim();
    }

    private ResponseEntity<Map<String, String>> badRequest(String mensaje) {
        return ResponseEntity.badRequest().body(Map.of("mensaje", mensaje));
    }
}
