package com.financeai.controller;

import com.financeai.service.CsvImportService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Importación CSV", description = "Carga movimientos y genera el perfil financiero")
public class CsvImportController {
    private final CsvImportService csvImportService;

    public CsvImportController(CsvImportService csvImportService) {
        this.csvImportService = csvImportService;
    }

    @PostMapping(value = "/{usuarioId}/importar-csv", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> importarCsv(
            @PathVariable String usuarioId,
            @RequestPart("archivo") MultipartFile archivo) throws Exception {
        return ResponseEntity.ok(csvImportService.importar(usuarioId, archivo));
    }
}
