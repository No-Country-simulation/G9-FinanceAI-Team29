package com.financeai.controller;

import com.financeai.model.Usuario;
import com.financeai.model.Recomendacion;
import com.financeai.repository.UsuarioRepository;
import com.financeai.repository.RecomendacionRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Usuarios", description = "Perfil, datos y recomendaciones de usuarios")
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final RecomendacionRepository recomendacionRepository;

    public UsuarioController(UsuarioRepository usuarioRepository,
                            RecomendacionRepository recomendacionRepository) {
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
            @RequestBody Usuario usuarioActualizado) {
        return usuarioRepository.findById(id)
            .map(usuario -> {
                usuario.setIngresoMensual(usuarioActualizado.getIngresoMensual());
                usuario.setDeudaMensual(usuarioActualizado.getDeudaMensual());
                usuario.setNivelEndeudamiento(usuarioActualizado.getNivelEndeudamiento());
                usuario.setFrecuenciaAhorro(usuarioActualizado.getFrecuenciaAhorro());
                return ResponseEntity.ok(usuarioRepository.save(usuario));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/recomendaciones")
    public ResponseEntity<List<Recomendacion>> obtenerRecomendaciones(@PathVariable String id) {
        List<Recomendacion> recomendaciones = recomendacionRepository.findByUsuarioIdAndActivaTrue(id);
        return ResponseEntity.ok(recomendaciones);
    }

    @GetMapping("/{id}/perfil")
    public ResponseEntity<Map<String, Object>> obtenerPerfil(@PathVariable String id) {
        return usuarioRepository.findById(id)
            .map(usuario -> {
                Map<String, Object> perfil = new java.util.HashMap<>();
                perfil.put("usuarioId", usuario.getId());
                perfil.put("perfilFinanciero", usuario.getPerfilFinanciero() != null ? usuario.getPerfilFinanciero() : "Sin clasificar");
                perfil.put("nivelEndeudamiento", usuario.getNivelEndeudamiento());
                perfil.put("frecuenciaAhorro", usuario.getFrecuenciaAhorro() != null ? usuario.getFrecuenciaAhorro() : "No definida");
                perfil.put("ingresoMensual", usuario.getIngresoMensual());
                perfil.put("ahorroEstimado", usuario.getAhorroMensualEstimado());
                return ResponseEntity.ok(perfil);
            })
            .orElse(ResponseEntity.notFound().build());
    }
}
