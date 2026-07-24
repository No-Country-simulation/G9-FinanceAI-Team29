package com.financeai.controller;

import com.financeai.dto.AnalisisRequest;
import com.financeai.dto.AnalisisResponse;
import com.financeai.service.AnalisisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@Tag(name = "Análisis financiero", description = "Análisis de perfil y clasificación de transacciones")
public class AnalisisController {

    private final AnalisisService analisisService;

    public AnalisisController(AnalisisService analisisService) {
        this.analisisService = analisisService;
    }

    @PostMapping("/analisis-financiero")
    @Operation(summary = "Analiza el comportamiento financiero del usuario",
        description = "Recibe ingresos, endeudamiento, frecuencia de ahorro y transacciones; "
            + "devuelve perfil financiero, resumen de gastos por categoría y recomendaciones.")
    public ResponseEntity<AnalisisResponse> analizarFinanzas(
            @Valid @RequestBody AnalisisRequest request,
            @RequestParam(defaultValue = "USR0001") String usuarioId) {

        AnalisisResponse response = analisisService.analizar(request, usuarioId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/clasificar")
    @Operation(summary = "Clasifica una transacción según su descripción",
        description = "Usa el modelo de ML si está disponible; si no, cae en las reglas internas.")
    public ResponseEntity<Map<String, String>> clasificar(@RequestParam String descripcion) {
        String categoria = analisisService.clasificarDescripcion(descripcion);
        return ResponseEntity.ok(Map.of(
            "descripcion", descripcion,
            "categoria", categoria
        ));
    }
}
