package com.financeai.controller;

import com.financeai.dto.*;
import com.financeai.service.GoalService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/usuarios/{usuarioId}/metas")
@Tag(name = "Metas", description = "Gestión de metas financieras")
public class GoalController {
    private final GoalService service;
    public GoalController(GoalService service) { this.service = service; }

    @GetMapping public List<GoalResponse> list(@PathVariable String usuarioId, @RequestParam(required = false) String estado) { return service.list(usuarioId, estado); }
    @GetMapping("/{goalId}") public GoalResponse get(@PathVariable String usuarioId, @PathVariable String goalId) { return service.get(usuarioId, goalId); }
    @PostMapping public GoalResponse create(@PathVariable String usuarioId, @Valid @RequestBody GoalCreateRequest request) { return service.create(usuarioId, request); }
    @PatchMapping("/{goalId}") public GoalResponse update(@PathVariable String usuarioId, @PathVariable String goalId, @Valid @RequestBody GoalUpdateRequest request) { return service.update(usuarioId, goalId, request); }
    @PostMapping("/{goalId}/aportes") public GoalResponse addSavings(@PathVariable String usuarioId, @PathVariable String goalId, @Valid @RequestBody GoalAmountRequest request) { return service.addSavings(usuarioId, goalId, request.monto()); }
    @Deprecated
    @PostMapping("/{goalId}/reservas") public GoalResponse reserve(@PathVariable String usuarioId, @PathVariable String goalId, @Valid @RequestBody GoalAmountRequest request) { return service.reserve(usuarioId, goalId, request.monto()); }
    @PostMapping("/{goalId}/liberaciones") public GoalResponse release(@PathVariable String usuarioId, @PathVariable String goalId, @Valid @RequestBody GoalAmountRequest request) { return service.release(usuarioId, goalId, request.monto()); }
    @DeleteMapping("/{goalId}") public ResponseEntity<GoalResponse> cancel(@PathVariable String usuarioId, @PathVariable String goalId) { return ResponseEntity.ok(service.cancel(usuarioId, goalId)); }
    @GetMapping("/resumen") public GoalSummaryResponse summary(@PathVariable String usuarioId) { return service.summary(usuarioId); }
}
