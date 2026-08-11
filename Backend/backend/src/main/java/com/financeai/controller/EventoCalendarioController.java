package com.financeai.controller;

import com.financeai.dto.EventoCalendarioCreateRequest;
import com.financeai.dto.EventoCalendarioResponse;
import com.financeai.dto.EventoCalendarioUpdateRequest;
import com.financeai.service.EventoCalendarioService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/usuarios/{usuarioId}/eventos-calendario")
@Tag(name = "Eventos de Calendario", description = "Eventos financieros que el usuario agrega manualmente en el calendario")
public class EventoCalendarioController {

    private final EventoCalendarioService service;

    public EventoCalendarioController(EventoCalendarioService service) {
        this.service = service;
    }

    @GetMapping
    public List<EventoCalendarioResponse> list(@PathVariable String usuarioId) {
        return service.list(usuarioId);
    }

    @PostMapping
    public EventoCalendarioResponse create(
        @PathVariable String usuarioId,
        @Valid @RequestBody EventoCalendarioCreateRequest request
    ) {
        return service.create(usuarioId, request);
    }

    @PatchMapping("/{eventoId}")
    public EventoCalendarioResponse update(
        @PathVariable String usuarioId,
        @PathVariable String eventoId,
        @Valid @RequestBody EventoCalendarioUpdateRequest request
    ) {
        return service.update(usuarioId, eventoId, request);
    }

    @DeleteMapping("/{eventoId}")
    public ResponseEntity<Void> delete(@PathVariable String usuarioId, @PathVariable String eventoId) {
        service.delete(usuarioId, eventoId);
        return ResponseEntity.noContent().build();
    }
}
