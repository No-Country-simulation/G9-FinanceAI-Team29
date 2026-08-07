package com.financeai.controller;

import com.financeai.service.ReclasificacionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@Tag(
        name = "Reclasificación",
        description = "Reclasificación de transacciones existentes mediante el AI-Service"
)
public class ReclasificacionController {

    private final ReclasificacionService reclasificacionService;

    public ReclasificacionController(
            ReclasificacionService reclasificacionService) {

        this.reclasificacionService = reclasificacionService;
    }

    /**
     * Endpoint puntual por usuario.
     *
     * Se conserva para pruebas o correcciones manuales.
     */
    @PostMapping("/usuarios/{usuarioId}/reclasificar")
    @Operation(
            summary = "Reclasifica las transacciones de un usuario",
            description =
                    "Envía los gastos existentes al AI-Service y actualiza "
                    + "su categoría y subcategoría sin borrar las transacciones."
    )
    public ResponseEntity<Map<String, Object>> reclasificarUsuario(
            @PathVariable String usuarioId) {

        Map<String, Object> resultado =
                reclasificacionService.reclasificarUsuario(usuarioId);

        return ResponseEntity.ok(resultado);
    }

    /**
     * Endpoint batch para toda la base.
     *
     * Solo toma gastos con subcategoria = null.
     * Los ingresos no se procesan.
     */
    @PostMapping("/admin/reclasificar-pendientes")
    @Operation(
            summary = "Reclasifica un lote de gastos pendientes",
            description =
                    "Procesa solamente gastos cuya subcategoría todavía sea null. "
                    + "El límite por defecto es 500 y el máximo permitido es 1000."
    )
    public ResponseEntity<Map<String, Object>> reclasificarPendientes(
            @RequestParam(required = false, defaultValue = "500")
            Integer limite) {

        Map<String, Object> resultado =
                reclasificacionService.reclasificarPendientes(limite);

        return ResponseEntity.ok(resultado);
    }
}