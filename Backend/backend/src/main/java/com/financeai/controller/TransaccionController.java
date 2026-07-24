package com.financeai.controller;

import com.financeai.dto.TransaccionResponseDTO;
import com.financeai.model.Transaccion;
import com.financeai.repository.TransaccionRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/usuarios/{usuarioId}/transacciones")
@CrossOrigin(origins = "*")
@Tag(name = "Transacciones", description = "Listado y resumen de transacciones por usuario")
public class TransaccionController {

    private final TransaccionRepository transaccionRepository;

    public TransaccionController(TransaccionRepository transaccionRepository) {
        this.transaccionRepository = transaccionRepository;
    }

    @GetMapping
    public ResponseEntity<List<TransaccionResponseDTO>> listarTransacciones(
            @PathVariable String usuarioId) {

        List<Transaccion> transacciones = transaccionRepository.findByUsuarioId(usuarioId);

        List<TransaccionResponseDTO> dtos = transacciones.stream()
            .map(this::toDTO)
            .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/resumen")
    public ResponseEntity<Map<String, Object>> resumenTransacciones(
            @PathVariable String usuarioId) {

        List<Transaccion> transacciones = transaccionRepository.findByUsuarioId(usuarioId);

        java.math.BigDecimal totalGastos = transacciones.stream()
            .filter(t -> "GASTO".equalsIgnoreCase(t.getTipo()))
            .map(Transaccion::getMonto)
            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        java.math.BigDecimal totalIngresos = transacciones.stream()
            .filter(t -> "INGRESO".equalsIgnoreCase(t.getTipo()))
            .map(Transaccion::getMonto)
            .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

        Map<String, java.math.BigDecimal> porCategoria = transacciones.stream()
            .filter(t -> "GASTO".equalsIgnoreCase(t.getTipo()) && t.getCategoria() != null)
            .collect(Collectors.groupingBy(
                t -> t.getCategoria().getNombre(),
                Collectors.reducing(java.math.BigDecimal.ZERO, Transaccion::getMonto, java.math.BigDecimal::add)
            ));

        return ResponseEntity.ok(Map.of(
            "totalGastos", totalGastos,
            "totalIngresos", totalIngresos,
            "porCategoria", porCategoria,
            "cantidadTransacciones", transacciones.size()
        ));
    }

    private TransaccionResponseDTO toDTO(Transaccion t) {
        TransaccionResponseDTO dto = new TransaccionResponseDTO();
        dto.setId(t.getId());
        dto.setDescripcion(t.getDescripcion());
        dto.setMonto(t.getMonto());
        dto.setCategoria(t.getCategoria() != null ? t.getCategoria().getNombre() : "Sin categoría");
        dto.setFecha(t.getFecha());
        dto.setTipo(t.getTipo());
        dto.setMedioPago(t.getMedioPago());
        dto.setRecurrente(t.getRecurrente());
        return dto;
    }
}
