package com.financeai.service;

import com.financeai.dto.RecomendacionDTO;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RecomendacionService {
    private static final String ADVERTENCIA = "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero.";

    public List<RecomendacionDTO> generarRecomendaciones(String perfilFinanciero,
            BigDecimal nivelEndeudamiento, BigDecimal porcentajeGastos, String frecuenciaAhorro,
            Map<String, BigDecimal> gastosPorCategoria, BigDecimal totalGastos,
            BigDecimal ingresoMensual) {
        List<RecomendacionDTO> recomendaciones = new ArrayList<>();
        Map.Entry<String, BigDecimal> principal = gastosPorCategoria.entrySet().stream()
            .filter(e -> e.getValue() != null)
            .max(Comparator.comparing(Map.Entry::getValue)).orElse(null);
        String categoria = principal != null ? principal.getKey() : "la categoría principal";
        BigDecimal montoCategoria = principal != null ? principal.getValue() : BigDecimal.ZERO;

        if (porcentajeGastos.compareTo(new BigDecimal("80")) >= 0) {
            recomendaciones.add(crear("gastos-altos-" + slug(categoria), "gastos_altos", perfilFinanciero,
                "alta", "Reducir el peso de los gastos",
                "Los gastos representan el " + pct(porcentajeGastos) + "% de los ingresos. " + categoria + " es la categoría de mayor consumo, con USD " + usd(montoCategoria) + ".",
                "Revisar primero los movimientos de " + categoria + " y buscar una reducción gradual del 5% al 10%, sin afectar necesidades esenciales.",
                "Llevar gradualmente los gastos totales por debajo del 75% de los ingresos.",
                Map.of("porcentajeGastos", porcentajeGastos, "categoriaPrincipal", categoria, "montoCategoriaUsd", montoCategoria),
                "Vengo de la recomendación 'Reducir el peso de los gastos'. Analiza conmigo los gastos de " + categoria + " y ayúdame a armar un plan concreto para reducirlos."));
        } else if (porcentajeGastos.compareTo(new BigDecimal("60")) >= 0) {
            recomendaciones.add(crear("optimizar-gastos-" + slug(categoria), "optimizacion_gastos", perfilFinanciero,
                "media", "Optimizar las categorías de mayor consumo",
                "Los gastos utilizan el " + pct(porcentajeGastos) + "% de los ingresos y la mayor concentración está en " + categoria + ".",
                "Comparar los movimientos de " + categoria + " e identificar ajustes posibles sin afectar gastos esenciales.",
                "Liberar al menos un 5% adicional de los ingresos para ahorro o imprevistos.",
                Map.of("porcentajeGastos", porcentajeGastos, "categoriaPrincipal", categoria),
                "Ayúdame a revisar la recomendación sobre optimizar mis gastos de " + categoria + " y proponme acciones concretas."));
        }

        if (nivelEndeudamiento.compareTo(new BigDecimal("35")) >= 0) {
            recomendaciones.add(crear("reducir-deuda-prioritaria", "deuda_alta", perfilFinanciero, "alta",
                "Priorizar la reducción de deuda",
                "Las obligaciones mensuales representan el " + pct(nivelEndeudamiento) + "% de los ingresos.",
                "Ordenar las deudas por costo financiero, evitar nuevas obligaciones y dirigir el excedente a la deuda más costosa.",
                "Reducir gradualmente las cuotas mensuales por debajo del 30% de los ingresos.",
                Map.of("nivelEndeudamiento", nivelEndeudamiento),
                "Vengo de la recomendación sobre reducir deuda. Ayúdame a priorizar pagos y crear un plan realista con mis datos."));
        }

        if ("Nunca".equalsIgnoreCase(frecuenciaAhorro) || "Baja".equalsIgnoreCase(frecuenciaAhorro)) {
            recomendaciones.add(crear("construir-capacidad-ahorro", "ahorro_bajo", perfilFinanciero,
                "En riesgo".equalsIgnoreCase(perfilFinanciero) ? "alta" : "media",
                "Construir capacidad de ahorro",
                "La frecuencia de ahorro registrada es " + frecuenciaAhorro.toLowerCase(Locale.ROOT) + ".",
                "Separar una parte de cada ingreso apenas se recibe y automatizar el ahorro cuando sea posible.",
                "Alcanzar primero un ahorro mensual equivalente al 10% de los ingresos.",
                Map.of("frecuenciaAhorro", frecuenciaAhorro),
                "Vengo de la recomendación sobre construir capacidad de ahorro. Ayúdame a definir un plan mensual paso a paso."));
        }

        if ("En riesgo".equalsIgnoreCase(perfilFinanciero)) {
            recomendaciones.add(crear("proteger-liquidez", "perfil_riesgo", perfilFinanciero, "alta",
                "Recuperar margen financiero",
                "El perfil financiero está En riesgo y requiere priorizar estabilidad antes de asumir nuevos compromisos.",
                "Revisar gastos recurrentes, evitar nuevas deudas y conservar liquidez para obligaciones esenciales.",
                "Recuperar un margen mensual positivo y sostenerlo durante al menos tres meses.",
                Map.of("perfilFinanciero", perfilFinanciero),
                "Vengo de la recomendación sobre recuperar margen financiero. Ayúdame a ordenar las primeras acciones con mis datos."));
        }

        if (recomendaciones.isEmpty()) {
            recomendaciones.add(crear("mantener-estabilidad", "perfil_saludable", perfilFinanciero, "sugerencia",
                "Mantener la estabilidad financiera",
                "Los datos actuales no activan alertas importantes.",
                "Monitorear los movimientos, mantener el ahorro y separar el fondo de emergencia de otras metas.",
                "Conservar un fondo de emergencia equivalente a entre 3 y 6 meses de gastos esenciales.",
                Map.of("perfilFinanciero", perfilFinanciero, "totalGastosUsd", totalGastos),
                "Vengo de la recomendación sobre mantener mi estabilidad financiera. Ayúdame a definir el siguiente objetivo."));
        }

        recomendaciones.sort(Comparator.comparingInt(r -> prioridad(r.getPrioridad())));
        return recomendaciones.stream().limit(4).toList();
    }

    private RecomendacionDTO crear(String id, String tipo, String perfil, String prioridad,
            String titulo, String diagnostico, String accion, String objetivo,
            Map<String, Object> evidencia, String preguntaFinsi) {
        return new RecomendacionDTO(id, tipo, perfil, prioridad, titulo, diagnostico, accion,
            objetivo, new LinkedHashMap<>(evidencia), preguntaFinsi, ADVERTENCIA);
    }
    private int prioridad(String p) { return "alta".equals(p) ? 0 : "media".equals(p) ? 1 : 2; }
    private String pct(BigDecimal v) { return v.setScale(1, RoundingMode.HALF_UP).toPlainString(); }
    private String usd(BigDecimal v) { return v.setScale(2, RoundingMode.HALF_UP).toPlainString(); }
    private String slug(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return normalized.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }
}
