package com.financeai.service;

import com.financeai.dto.AnalisisRequest;
import com.financeai.dto.AnalisisResponse;
import com.financeai.dto.TransaccionDTO;
import com.financeai.model.*;
import com.financeai.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalisisService {

    private final ClasificacionService clasificacionService;
    private final RecomendacionService recomendacionService;
    private final UsuarioRepository usuarioRepository;
    private final PerfilHistorialRepository perfilHistorialRepository;

    public AnalisisService(
            ClasificacionService clasificacionService,
            RecomendacionService recomendacionService,
            UsuarioRepository usuarioRepository,
            PerfilHistorialRepository perfilHistorialRepository) {
        this.clasificacionService = clasificacionService;
        this.recomendacionService = recomendacionService;
        this.usuarioRepository = usuarioRepository;
        this.perfilHistorialRepository = perfilHistorialRepository;
    }

    @Transactional
    public AnalisisResponse analizar(AnalisisRequest request, String usuarioId) {
        Map<String, BigDecimal> gastosPorCategoria = new HashMap<>();
        BigDecimal totalGastos = BigDecimal.ZERO;

        for (TransaccionDTO t : request.getTransacciones()) {
            String categoriaNombre = clasificacionService.clasificarTransaccion(t.getDescripcion());
            gastosPorCategoria.merge(categoriaNombre, t.getValor(), BigDecimal::add);
            totalGastos = totalGastos.add(t.getValor());
        }

        BigDecimal porcentajeGastos = BigDecimal.ZERO;
        if (request.getIngresoMensual().compareTo(BigDecimal.ZERO) > 0) {
            porcentajeGastos = totalGastos.multiply(new BigDecimal("100"))
                .divide(request.getIngresoMensual(), 2, RoundingMode.HALF_UP);
        }

        BigDecimal porcentajeAhorro = BigDecimal.ONE.subtract(
            porcentajeGastos.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP)
        ).multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);

        String perfil = clasificarPerfil(request.getNivelEndeudamiento(), porcentajeGastos, request.getFrecuenciaAhorro());
        BigDecimal probabilidad = calcularProbabilidad(perfil, request.getNivelEndeudamiento(), porcentajeGastos);
        String nivelRiesgo = determinarNivelRiesgo(request.getNivelEndeudamiento(), porcentajeGastos);

        List<String> recomendaciones = recomendacionService.generarRecomendaciones(
            perfil, request.getNivelEndeudamiento(), porcentajeGastos,
            request.getFrecuenciaAhorro(), gastosPorCategoria, totalGastos, request.getIngresoMensual());

        AnalisisResponse.ResumenGastosDTO resumen = new AnalisisResponse.ResumenGastosDTO();
        Map<String, BigDecimal> porcentajes = new HashMap<>();
        if (totalGastos.compareTo(BigDecimal.ZERO) > 0) {
            for (Map.Entry<String, BigDecimal> entry : gastosPorCategoria.entrySet()) {
                BigDecimal pct = entry.getValue().multiply(new BigDecimal("100"))
                    .divide(totalGastos, 2, RoundingMode.HALF_UP);
                porcentajes.put(entry.getKey(), pct);
            }
        }
        resumen.setPorCategoria(gastosPorCategoria);
        resumen.setPorcentajes(porcentajes);

        AnalisisResponse response = new AnalisisResponse();
        response.setPerfilFinanciero(perfil);
        response.setProbabilidad(probabilidad);
        response.setResumenGastos(resumen);
        response.setTotalGastos(totalGastos);
        response.setTotalIngresos(request.getIngresoMensual());
        response.setPorcentajeAhorro(porcentajeAhorro);
        response.setNivelRiesgo(nivelRiesgo);
        response.setRecomendaciones(recomendaciones);

        guardarHistorial(usuarioId, response);

        return response;
    }

    /**
     * Registra el análisis en el historial del usuario (si el usuario existe).
     * Solo persiste cuando el usuario está en la BD, para no violar la FK.
     */
    private void guardarHistorial(String usuarioId, AnalisisResponse response) {
        if (usuarioId == null) {
            return;
        }
        usuarioRepository.findById(usuarioId).ifPresent(usuario -> {
            PerfilHistorial historial = new PerfilHistorial();
            historial.setUsuario(usuario);
            historial.setPerfilPredicho(response.getPerfilFinanciero());
            historial.setProbabilidad(response.getProbabilidad());
            historial.setFechaAnalisis(LocalDateTime.now());
            historial.setDetalles(construirDetalles(response));
            perfilHistorialRepository.save(historial);
        });
    }

    /** Construye un JSON compacto con las métricas del análisis (columna jsonb). */
    private String construirDetalles(AnalisisResponse r) {
        return String.format(java.util.Locale.US,
            "{\"totalGastos\":%s,\"totalIngresos\":%s,\"porcentajeAhorro\":%s,\"nivelRiesgo\":\"%s\"}",
            r.getTotalGastos().toPlainString(),
            r.getTotalIngresos().toPlainString(),
            r.getPorcentajeAhorro().toPlainString(),
            r.getNivelRiesgo());
    }

    private String clasificarPerfil(BigDecimal nivelEndeudamiento, BigDecimal porcentajeGastos, String frecuenciaAhorro) {
        int puntos = 0;

        if (nivelEndeudamiento.compareTo(new BigDecimal("20")) <= 0) puntos += 3;
        else if (nivelEndeudamiento.compareTo(new BigDecimal("40")) <= 0) puntos += 1;
        else puntos -= 1;

        if (porcentajeGastos.compareTo(new BigDecimal("50")) <= 0) puntos += 3;
        else if (porcentajeGastos.compareTo(new BigDecimal("70")) <= 0) puntos += 1;
        else puntos -= 1;

        switch (frecuenciaAhorro) {
            case "Alta": puntos += 3; break;
            case "Media": puntos += 1; break;
            case "Baja": puntos -= 1; break;
            case "Nunca": puntos -= 3; break;
        }

        if (puntos >= 5) return "Saludable";
        if (puntos >= 2) return "En observación";
        return "En riesgo";
    }

    private BigDecimal calcularProbabilidad(String perfil, BigDecimal nivelEndeudamiento, BigDecimal porcentajeGastos) {
        BigDecimal base = BigDecimal.ZERO;
        switch (perfil) {
            case "Saludable": base = new BigDecimal("0.85"); break;
            case "En observación": base = new BigDecimal("0.65"); break;
            case "En riesgo": base = new BigDecimal("0.40"); break;
        }

        if (nivelEndeudamiento.compareTo(new BigDecimal("30")) > 0) {
            base = base.subtract(new BigDecimal("0.10"));
        }
        if (porcentajeGastos.compareTo(new BigDecimal("70")) > 0) {
            base = base.subtract(new BigDecimal("0.10"));
        }

        return base.setScale(4, RoundingMode.HALF_UP).max(new BigDecimal("0.01")).min(new BigDecimal("0.99"));
    }

    private String determinarNivelRiesgo(BigDecimal nivelEndeudamiento, BigDecimal porcentajeGastos) {
        if (nivelEndeudamiento.compareTo(new BigDecimal("50")) > 0 ||
            porcentajeGastos.compareTo(new BigDecimal("90")) > 0) {
            return "Alto";
        }
        if (nivelEndeudamiento.compareTo(new BigDecimal("30")) > 0 ||
            porcentajeGastos.compareTo(new BigDecimal("70")) > 0) {
            return "Medio";
        }
        return "Bajo";
    }
}
