package com.financeai.controller;

import com.financeai.model.Recomendacion;
import com.financeai.model.Usuario;
import com.financeai.repository.RecomendacionRepository;
import com.financeai.repository.UsuarioRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*")
@Tag(name = "Usuarios", description = "Perfil, datos y recomendaciones de usuarios")
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final RecomendacionRepository recomendacionRepository;

    public UsuarioController(
            UsuarioRepository usuarioRepository,
            RecomendacionRepository recomendacionRepository
    ) {
        this.usuarioRepository = usuarioRepository;
        this.recomendacionRepository = recomendacionRepository;
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

    @GetMapping("/{id}/recomendaciones")
    public ResponseEntity<List<Recomendacion>> obtenerRecomendaciones(
            @PathVariable String id
    ) {
        List<Recomendacion> recomendaciones =
                recomendacionRepository.findByUsuarioIdAndActivaTrue(id);

        return ResponseEntity.ok(recomendaciones);
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
