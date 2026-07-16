package com.financeai.controller;

import com.financeai.dto.AnalisisRequest;
import com.financeai.dto.AnalisisResponse;
import com.financeai.service.AnalisisService;
import com.financeai.service.ClasificacionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@Tag(name = "Análisis financiero", description = "Análisis de perfil y clasificación de transacciones")
public class AnalisisController {

    private final AnalisisService analisisService;
    private final ClasificacionService clasificacionService;

    public AnalisisController(AnalisisService analisisService,
                             ClasificacionService clasificacionService) {
        this.analisisService = analisisService;
        this.clasificacionService = clasificacionService;
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
    @Operation(summary = "Clasifica una transacción según su descripción")
    public ResponseEntity<Map<String, String>> clasificar(@RequestParam String descripcion) {
        String categoria = clasificacionService.clasificarTransaccion(descripcion);
        return ResponseEntity.ok(Map.of(
            "descripcion", descripcion,
            "categoria", categoria
        ));
    }
}
