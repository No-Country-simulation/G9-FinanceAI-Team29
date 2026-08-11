package com.financeai.controller;

import com.financeai.dto.*;
import com.financeai.service.GamificacionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/usuarios/{usuarioId}/gamificacion")
@Tag(name = "Gamificación", description = "Progreso de retos, trivia y logros")
public class GamificacionController {

    private final GamificacionService service;

    public GamificacionController(GamificacionService service) {
        this.service = service;
    }

    @GetMapping("/retos")
    public List<RetoProgresoResponse> listarRetos(@PathVariable String usuarioId, @RequestParam String semana) {
        return service.listarRetos(usuarioId, semana);
    }

    @PutMapping("/retos/{retoId}")
    public RetoProgresoResponse guardarReto(
            @PathVariable String usuarioId,
            @PathVariable String retoId,
            @Valid @RequestBody RetoProgresoUpdateRequest request
    ) {
        return service.guardarReto(usuarioId, retoId, request);
    }

    @GetMapping("/trivia/estadisticas")
    public TriviaEstadisticasResponse estadisticasTrivia(@PathVariable String usuarioId) {
        return service.obtenerEstadisticasTrivia(usuarioId);
    }

    @PostMapping("/trivia")
    public void registrarTrivia(@PathVariable String usuarioId, @Valid @RequestBody TriviaResultadoRequest request) {
        service.registrarResultadosTrivia(usuarioId, request);
    }

    @GetMapping("/logros")
    public List<LogroResponse> listarLogros(@PathVariable String usuarioId) {
        return service.listarLogros(usuarioId);
    }

    @PostMapping("/logros/{logroId}")
    public LogroResponse desbloquearLogro(@PathVariable String usuarioId, @PathVariable String logroId) {
        return service.desbloquearLogro(usuarioId, logroId);
    }

    @GetMapping("/estado")
    public ResponseEntity<EstadoGamificacionResponse> obtenerEstado(@PathVariable String usuarioId) {
        return service.obtenerEstado(usuarioId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/estado")
    public EstadoGamificacionResponse guardarEstado(
            @PathVariable String usuarioId,
            @Valid @RequestBody EstadoGamificacionUpdateRequest request
    ) {
        return service.guardarEstado(usuarioId, request);
    }
}
