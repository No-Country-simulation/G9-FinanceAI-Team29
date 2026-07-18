package com.financeai.dto;

import java.math.BigDecimal;
import java.util.Map;

public class AnalisisResponse {

    private String perfilFinanciero;
    private BigDecimal probabilidad;
    private ResumenGastosDTO resumenGastos;
    private BigDecimal totalGastos;
    private BigDecimal totalIngresos;
    private BigDecimal porcentajeAhorro;
    private String nivelRiesgo;
    private java.util.List<String> recomendaciones;

    // ---- Campos provenientes del modelo de ML (null cuando se usan las reglas internas) ----
    private Integer financialScore;
    private String scoreStatus;
    private String scoreColor;
    private String explicacion;
    private java.util.List<String> fortalezas;
    private java.util.List<String> oportunidadesMejora;

    /** Indica de dónde salió el análisis: "ML" o "reglas". Útil para depurar/demostrar. */
    private String motorAnalisis;

    public AnalisisResponse() {}

    public String getPerfilFinanciero() { return perfilFinanciero; }
    public void setPerfilFinanciero(String perfilFinanciero) { this.perfilFinanciero = perfilFinanciero; }

    public BigDecimal getProbabilidad() { return probabilidad; }
    public void setProbabilidad(BigDecimal probabilidad) { this.probabilidad = probabilidad; }

    public Integer getFinancialScore() { return financialScore; }
    public void setFinancialScore(Integer financialScore) { this.financialScore = financialScore; }

    public String getScoreStatus() { return scoreStatus; }
    public void setScoreStatus(String scoreStatus) { this.scoreStatus = scoreStatus; }

    public String getScoreColor() { return scoreColor; }
    public void setScoreColor(String scoreColor) { this.scoreColor = scoreColor; }

    public String getExplicacion() { return explicacion; }
    public void setExplicacion(String explicacion) { this.explicacion = explicacion; }

    public java.util.List<String> getFortalezas() { return fortalezas; }
    public void setFortalezas(java.util.List<String> fortalezas) { this.fortalezas = fortalezas; }

    public java.util.List<String> getOportunidadesMejora() { return oportunidadesMejora; }
    public void setOportunidadesMejora(java.util.List<String> oportunidadesMejora) { this.oportunidadesMejora = oportunidadesMejora; }

    public String getMotorAnalisis() { return motorAnalisis; }
    public void setMotorAnalisis(String motorAnalisis) { this.motorAnalisis = motorAnalisis; }

    public ResumenGastosDTO getResumenGastos() { return resumenGastos; }
    public void setResumenGastos(ResumenGastosDTO resumenGastos) { this.resumenGastos = resumenGastos; }

    public BigDecimal getTotalGastos() { return totalGastos; }
    public void setTotalGastos(BigDecimal totalGastos) { this.totalGastos = totalGastos; }

    public BigDecimal getTotalIngresos() { return totalIngresos; }
    public void setTotalIngresos(BigDecimal totalIngresos) { this.totalIngresos = totalIngresos; }

    public BigDecimal getPorcentajeAhorro() { return porcentajeAhorro; }
    public void setPorcentajeAhorro(BigDecimal porcentajeAhorro) { this.porcentajeAhorro = porcentajeAhorro; }

    public String getNivelRiesgo() { return nivelRiesgo; }
    public void setNivelRiesgo(String nivelRiesgo) { this.nivelRiesgo = nivelRiesgo; }

    public java.util.List<String> getRecomendaciones() { return recomendaciones; }
    public void setRecomendaciones(java.util.List<String> recomendaciones) { this.recomendaciones = recomendaciones; }

    public static class ResumenGastosDTO {
        private Map<String, BigDecimal> porCategoria;
        private Map<String, BigDecimal> porcentajes;

        public ResumenGastosDTO() {}

        public Map<String, BigDecimal> getPorCategoria() { return porCategoria; }
        public void setPorCategoria(Map<String, BigDecimal> porCategoria) { this.porCategoria = porCategoria; }

        public Map<String, BigDecimal> getPorcentajes() { return porcentajes; }
        public void setPorcentajes(Map<String, BigDecimal> porcentajes) { this.porcentajes = porcentajes; }
    }
}
