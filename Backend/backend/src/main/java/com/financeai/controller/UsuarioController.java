package com.financeai.controller;

import com.financeai.dto.PerfilActualizadoResponse;
import com.financeai.dto.ProfileUpdateRequest;
import jakarta.validation.Valid;
import com.financeai.model.Recomendacion;
import com.financeai.model.EstadoUsuario;
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

                        // El auth vive en el backend: basta con actualizar el email local.
                        usuario.setEmail(emailNormalizado);
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
