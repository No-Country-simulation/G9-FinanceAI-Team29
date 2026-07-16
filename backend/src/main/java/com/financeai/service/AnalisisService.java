package com.financeai.service;

import com.financeai.dto.AnalisisRequest;
import com.financeai.dto.AnalisisResponse;
import com.financeai.dto.TransaccionDTO;
import com.financeai.dto.ml.MlAnalysisRequest;
import com.financeai.dto.ml.MlAnalysisResponse;
import com.financeai.dto.ml.MlPredictResponse;
import com.financeai.dto.ml.MlTransaccion;
import com.financeai.model.*;
import com.financeai.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class AnalisisService {

    private static final Logger log = LoggerFactory.getLogger(AnalisisService.class);

    private final ClasificacionService clasificacionService;
    private final RecomendacionService recomendacionService;
    private final MlService mlService;
    private final UsuarioRepository usuarioRepository;
    private final PerfilHistorialRepository perfilHistorialRepository;

    /**
     * Confianza mínima para fiarnos de la categoría del ML. Si baja de esto,
     * tiramos de las reglas de siempre (los casos claros tipo "Supermercado"
     * los clavan igual). Se puede tocar desde application.yml.
     */
    @Value("${ml.service.classification-confidence-threshold:0.5}")
    private double umbralConfianzaClasificacion;

    public AnalisisService(
            ClasificacionService clasificacionService,
            RecomendacionService recomendacionService,
            MlService mlService,
            UsuarioRepository usuarioRepository,
            PerfilHistorialRepository perfilHistorialRepository) {
        this.clasificacionService = clasificacionService;
        this.recomendacionService = recomendacionService;
        this.mlService = mlService;
        this.usuarioRepository = usuarioRepository;
        this.perfilHistorialRepository = perfilHistorialRepository;
    }

    @Transactional
    public AnalisisResponse analizar(AnalisisRequest request, String usuarioId) {
        // ¿Está arriba el microservicio de ML? Se consulta una sola vez por petición.
        boolean mlUp = mlService.estaDisponible();

        // 1) Clasificar cada transacción (ML o reglas) y acumular gastos por categoría.
        Map<String, BigDecimal> gastosPorCategoria = new LinkedHashMap<>();
        BigDecimal totalGastos = BigDecimal.ZERO;
        List<MlTransaccion> transaccionesMl = new ArrayList<>();

        for (TransaccionDTO t : request.getTransacciones()) {
            String categoria = clasificar(t, mlUp);
            gastosPorCategoria.merge(categoria, t.getValor(), BigDecimal::add);
            totalGastos = totalGastos.add(t.getValor());
            transaccionesMl.add(aMlTransaccion(t, categoria));
        }

        // 2) Métricas derivadas.
        BigDecimal porcentajeGastos = BigDecimal.ZERO;
        if (request.getIngresoMensual().compareTo(BigDecimal.ZERO) > 0) {
            porcentajeGastos = totalGastos.multiply(new BigDecimal("100"))
                .divide(request.getIngresoMensual(), 2, RoundingMode.HALF_UP);
        }

        BigDecimal porcentajeAhorro = BigDecimal.ONE.subtract(
            porcentajeGastos.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP)
        ).multiply(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);

        // 3) Respuesta base: resumen de gastos y totales (siempre los calcula el backend).
        AnalisisResponse response = new AnalisisResponse();
        response.setResumenGastos(construirResumen(gastosPorCategoria, totalGastos));
        response.setTotalGastos(totalGastos);
        response.setTotalIngresos(request.getIngresoMensual());
        response.setPorcentajeAhorro(porcentajeAhorro);

        // 4) Perfil financiero: primero el modelo de ML; si falla, reglas internas.
        boolean analizadoConMl = false;
        if (mlUp) {
            try {
                MlAnalysisRequest mlReq = construirRequestMl(
                    request, usuarioId, totalGastos, porcentajeGastos, transaccionesMl);
                MlAnalysisResponse ml = mlService.analizar(mlReq);
                aplicarResultadoMl(response, ml);
                analizadoConMl = true;
                log.info("Análisis de perfil resuelto por el modelo de ML (usuario {}).", usuarioId);
            } catch (Exception e) {
                log.warn("Falló /analysis del ML, se usan las reglas internas: {}", e.getMessage());
            }
        }

        if (!analizadoConMl) {
            aplicarResultadoReglas(response, request, gastosPorCategoria, totalGastos, porcentajeGastos);
        }

        // 5) Persistir en el historial (solo si el usuario existe en la BD).
        guardarHistorial(usuarioId, response);

        return response;
    }

    /**
     * Clasifica una sola descripción (el endpoint GET /clasificar).
     * Primero prueba el ML y, si no está o falla, usa las reglas.
     */
    public String clasificarDescripcion(String descripcion) {
        if (descripcion == null || descripcion.isBlank()) {
            return "Otros";
        }
        if (mlService.estaDisponible()) {
            MlTransaccion tx = new MlTransaccion(
                LocalDate.now().toString(), descripcion, BigDecimal.ZERO,
                null, "desconocido", "no");
            String categoriaMl = categoriaSiConfiable(tx);
            if (categoriaMl != null) {
                return categoriaMl;
            }
        }
        return clasificacionService.clasificarTransaccion(descripcion);
    }

    /**
     * Devuelve la categoría del ML solo si su confianza pasa el umbral; si no
     * (o si algo falla) devuelve null para que quien llama use las reglas.
     */
    private String categoriaSiConfiable(MlTransaccion tx) {
        try {
            MlPredictResponse r = mlService.predecirCategoria(tx);
            if (r.getConfianza() != null
                    && r.getConfianza().doubleValue() >= umbralConfianzaClasificacion) {
                return r.getCategoriaPredicha();
            }
            log.debug("ML poco seguro ({}) para '{}', se usa regla.",
                r.getConfianza(), tx.getDescripcion());
        } catch (Exception e) {
            log.warn("Falló /predict/category para '{}', se usa regla: {}",
                tx.getDescripcion(), e.getMessage());
        }
        return null;
    }

    // ---------------------------------------------------------------------
    //  Clasificación (ML con fallback a reglas)
    // ---------------------------------------------------------------------

    private String clasificar(TransaccionDTO t, boolean mlUp) {
        if (mlUp) {
            String categoriaMl = categoriaSiConfiable(aMlTransaccion(t, null));
            if (categoriaMl != null) {
                return categoriaMl;
            }
        }
        return clasificacionService.clasificarTransaccion(t.getDescripcion());
    }

    /** Convierte una transacción del request en el formato que espera el ML, con defaults. */
    private MlTransaccion aMlTransaccion(TransaccionDTO t, String categoria) {
        String fecha = t.getFecha() != null ? t.getFecha().toString() : LocalDate.now().toString();
        String medioPago = tieneTexto(t.getMedioPago()) ? t.getMedioPago() : "desconocido";
        String recurrente = tieneTexto(t.getRecurrente()) ? t.getRecurrente() : "no";
        return new MlTransaccion(fecha, t.getDescripcion(), t.getValor(), categoria, medioPago, recurrente);
    }

    private boolean tieneTexto(String s) {
        return s != null && !s.isBlank();
    }

    // ---------------------------------------------------------------------
    //  Construcción del request al ML y mapeo de su respuesta
    // ---------------------------------------------------------------------

    private MlAnalysisRequest construirRequestMl(
            AnalisisRequest request, String usuarioId,
            BigDecimal totalGastos, BigDecimal porcentajeGastos,
            List<MlTransaccion> transaccionesMl) {

        BigDecimal ingreso = request.getIngresoMensual();

        // Campos que el modelo necesita y el backend deriva de lo que ya tiene.
        BigDecimal deudaMensual = ingreso
            .multiply(request.getNivelEndeudamiento())
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal ahorroEstimado = ingreso.subtract(totalGastos).setScale(2, RoundingMode.HALF_UP);

        MlAnalysisRequest mlReq = new MlAnalysisRequest();
        mlReq.setUsuarioId(usuarioId != null ? usuarioId : "USR0001");
        mlReq.setIngresoMensual(ingreso);
        mlReq.setDeudaMensual(deudaMensual);
        mlReq.setGastoMensualPromedio(totalGastos);
        mlReq.setAhorroMensualEstimado(ahorroEstimado);
        mlReq.setNivelEndeudamiento(request.getNivelEndeudamiento());
        mlReq.setPorcentajeGastosIngreso(porcentajeGastos);
        mlReq.setFrecuenciaAhorro(request.getFrecuenciaAhorro());
        mlReq.setTransacciones(transaccionesMl);
        return mlReq;
    }

    private void aplicarResultadoMl(AnalisisResponse response, MlAnalysisResponse ml) {
        response.setPerfilFinanciero(ml.getPerfilFinanciero());
        response.setProbabilidad(ml.getConfianzaPerfil());
        response.setNivelRiesgo(ml.getNivelRiesgo());
        response.setRecomendaciones(ml.getRecomendaciones());
        response.setFinancialScore(ml.getFinancialScore());
        response.setScoreStatus(ml.getScoreStatus());
        response.setScoreColor(ml.getScoreColor());
        response.setExplicacion(ml.getExplicacion());
        response.setFortalezas(ml.getFortalezas());
        response.setOportunidadesMejora(ml.getOportunidadesMejora());
        response.setMotorAnalisis("ML");
    }

    // ---------------------------------------------------------------------
    //  Fallback: reglas internas (comportamiento original)
    // ---------------------------------------------------------------------

    private void aplicarResultadoReglas(
            AnalisisResponse response, AnalisisRequest request,
            Map<String, BigDecimal> gastosPorCategoria,
            BigDecimal totalGastos, BigDecimal porcentajeGastos) {

        String perfil = clasificarPerfil(
            request.getNivelEndeudamiento(), porcentajeGastos, request.getFrecuenciaAhorro());
        BigDecimal probabilidad = calcularProbabilidad(
            perfil, request.getNivelEndeudamiento(), porcentajeGastos);
        String nivelRiesgo = determinarNivelRiesgo(
            request.getNivelEndeudamiento(), porcentajeGastos);

        List<String> recomendaciones = recomendacionService.generarRecomendaciones(
            perfil, request.getNivelEndeudamiento(), porcentajeGastos,
            request.getFrecuenciaAhorro(), gastosPorCategoria, totalGastos, request.getIngresoMensual());

        response.setPerfilFinanciero(perfil);
        response.setProbabilidad(probabilidad);
        response.setNivelRiesgo(nivelRiesgo);
        response.setRecomendaciones(recomendaciones);
        response.setMotorAnalisis("reglas");
    }

    private AnalisisResponse.ResumenGastosDTO construirResumen(
            Map<String, BigDecimal> gastosPorCategoria, BigDecimal totalGastos) {

        AnalisisResponse.ResumenGastosDTO resumen = new AnalisisResponse.ResumenGastosDTO();
        Map<String, BigDecimal> porcentajes = new LinkedHashMap<>();
        if (totalGastos.compareTo(BigDecimal.ZERO) > 0) {
            for (Map.Entry<String, BigDecimal> entry : gastosPorCategoria.entrySet()) {
                BigDecimal pct = entry.getValue().multiply(new BigDecimal("100"))
                    .divide(totalGastos, 2, RoundingMode.HALF_UP);
                porcentajes.put(entry.getKey(), pct);
            }
        }
        resumen.setPorCategoria(gastosPorCategoria);
        resumen.setPorcentajes(porcentajes);
        return resumen;
    }

    // ---------------------------------------------------------------------
    //  Historial
    // ---------------------------------------------------------------------

    /**
     * Guarda el análisis en el historial del usuario (solo si el usuario existe).
     * Si no está en la BD no lo persistimos, para no romper la FK.
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
            "{\"totalGastos\":%s,\"totalIngresos\":%s,\"porcentajeAhorro\":%s,\"nivelRiesgo\":\"%s\",\"motor\":\"%s\"}",
            r.getTotalGastos().toPlainString(),
            r.getTotalIngresos().toPlainString(),
            r.getPorcentajeAhorro().toPlainString(),
            r.getNivelRiesgo(),
            r.getMotorAnalisis());
    }

    // ---------------------------------------------------------------------
    //  Reglas internas de perfil (fallback)
    // ---------------------------------------------------------------------

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
