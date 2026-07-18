package com.financeai.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class RecomendacionService {

    public List<String> generarRecomendaciones(
            String perfilFinanciero,
            BigDecimal nivelEndeudamiento,
            BigDecimal porcentajeGastos,
            String frecuenciaAhorro,
            Map<String, BigDecimal> gastosPorCategoria,
            BigDecimal totalGastos,
            BigDecimal ingresoMensual) {

        List<String> recomendaciones = new ArrayList<>();

        if (nivelEndeudamiento.compareTo(new BigDecimal("30")) > 0) {
            recomendaciones.add("Reducir el nivel de endeudamiento actual del " +
                nivelEndeudamiento.setScale(1, RoundingMode.HALF_UP) + "%. " +
                "Intenta que no supere el 30% de tus ingresos.");
        }

        if (porcentajeGastos.compareTo(new BigDecimal("70")) > 0) {
            recomendaciones.add("Tus gastos representan el " +
                porcentajeGastos.setScale(1, RoundingMode.HALF_UP) +
                "% de tus ingresos. Intenta reducir gastos no esenciales.");
        }

        if ("Nunca".equals(frecuenciaAhorro) || "Baja".equals(frecuenciaAhorro)) {
            recomendaciones.add("Aumentar la frecuencia de ahorro. " +
                "Establece un ahorro automático mensual mínimo del 10% de tus ingresos.");
        }

        if (gastosPorCategoria.containsKey("Ocio") && ingresoMensual.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal gastoOcio = gastosPorCategoria.get("Ocio");
            BigDecimal porcentajeOcio = gastoOcio.multiply(new BigDecimal("100"))
                .divide(ingresoMensual, 2, RoundingMode.HALF_UP);
            if (porcentajeOcio.compareTo(new BigDecimal("15")) > 0) {
                recomendaciones.add("Los gastos en ocio representan el " + porcentajeOcio + "% de tus ingresos. " +
                    "Considera reducir gastos en entretenimiento.");
            }
        }

        if (gastosPorCategoria.containsKey("Alimentación") && ingresoMensual.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal gastoAlimentacion = gastosPorCategoria.get("Alimentación");
            BigDecimal porcentajeAlim = gastoAlimentacion.multiply(new BigDecimal("100"))
                .divide(ingresoMensual, 2, RoundingMode.HALF_UP);
            if (porcentajeAlim.compareTo(new BigDecimal("25")) > 0) {
                recomendaciones.add("Los gastos en alimentación son altos (" + porcentajeAlim + "%). " +
                    "Considera cocinar en casa y planificar comidas.");
            }
        }

        if ("En riesgo".equals(perfilFinanciero)) {
            recomendaciones.add("Tu perfil financiero está en riesgo. " +
                "Revisa todos tus gastos recurrentes y elimina suscripciones innecesarias.");
            recomendaciones.add("Establece un fondo de emergencia equivalente a 3-6 meses de gastos.");
        }

        if (recomendaciones.isEmpty()) {
            recomendaciones.add("Mantén tus buenos hábitos financieros. " +
                "Continúa monitoreando tus gastos regularmente.");
        }

        return recomendaciones;
    }
}
