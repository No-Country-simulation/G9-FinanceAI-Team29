package com.financeai.controller;

import com.financeai.dto.PagedResponse;
import com.financeai.dto.ResumenTransaccionesDTO;
import com.financeai.dto.TransaccionResponseDTO;
import com.financeai.model.Transaccion;
import com.financeai.repository.TransaccionRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/usuarios/{usuarioId}/transacciones")
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

    /**
     * Igual que el listado, pero paginado: trae las transacciones de a tandas.
     * Ej: GET /api/usuarios/{id}/transacciones/pagina?page=0&size=20
     * Por defecto: 20 por página, ordenadas por fecha descendente (más nuevas primero).
     */
    @GetMapping("/pagina")
    public ResponseEntity<PagedResponse<TransaccionResponseDTO>> listarPaginado(
            @PathVariable String usuarioId,
            @PageableDefault(size = 20, sort = "fecha", direction = Sort.Direction.DESC)
            Pageable pageable) {

        Page<TransaccionResponseDTO> pagina =
            transaccionRepository.findByUsuarioId(usuarioId, pageable).map(this::toDTO);

        return ResponseEntity.ok(PagedResponse.from(pagina));
    }

    @GetMapping("/resumen")
    public ResponseEntity<ResumenTransaccionesDTO> resumenTransacciones(
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

        return ResponseEntity.ok(new ResumenTransaccionesDTO(
            totalGastos,
            totalIngresos,
            porCategoria,
            transacciones.size()
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
