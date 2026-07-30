package com.financeai.dto.ml;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Lo que devuelve el POST /analysis del ML.
 * Solo mapeo los campos que uso en el backend; el resto lo ignoro.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class MlAnalysisResponse {

    @JsonProperty("usuario_id")
    private String usuarioId;

    @JsonProperty("financial_score")
    private Integer financialScore;

    @JsonProperty("score_status")
    private String scoreStatus;

    @JsonProperty("score_color")
    private String scoreColor;

    @JsonProperty("nivel_riesgo")
    private String nivelRiesgo;

    @JsonProperty("perfil_financiero")
    private String perfilFinanciero;

    @JsonProperty("confianza_perfil")
    private BigDecimal confianzaPerfil;

    @JsonProperty("explicacion")
    private String explicacion;

    @JsonProperty("fortalezas")
    private List<String> fortalezas;

    @JsonProperty("oportunidades_mejora")
    private List<String> oportunidadesMejora;

    @JsonProperty("recomendaciones")
    private List<String> recomendaciones;

    @JsonProperty("modelo_version")
    private String modeloVersion;

    public String getUsuarioId() { return usuarioId; }
    public void setUsuarioId(String usuarioId) { this.usuarioId = usuarioId; }

    public Integer getFinancialScore() { return financialScore; }
    public void setFinancialScore(Integer financialScore) { this.financialScore = financialScore; }

    public String getScoreStatus() { return scoreStatus; }
    public void setScoreStatus(String scoreStatus) { this.scoreStatus = scoreStatus; }

    public String getScoreColor() { return scoreColor; }
    public void setScoreColor(String scoreColor) { this.scoreColor = scoreColor; }

    public String getNivelRiesgo() { return nivelRiesgo; }
    public void setNivelRiesgo(String nivelRiesgo) { this.nivelRiesgo = nivelRiesgo; }

    public String getPerfilFinanciero() { return perfilFinanciero; }
    public void setPerfilFinanciero(String perfilFinanciero) { this.perfilFinanciero = perfilFinanciero; }

    public BigDecimal getConfianzaPerfil() { return confianzaPerfil; }
    public void setConfianzaPerfil(BigDecimal confianzaPerfil) { this.confianzaPerfil = confianzaPerfil; }

    public String getExplicacion() { return explicacion; }
    public void setExplicacion(String explicacion) { this.explicacion = explicacion; }

    public List<String> getFortalezas() { return fortalezas; }
    public void setFortalezas(List<String> fortalezas) { this.fortalezas = fortalezas; }

    public List<String> getOportunidadesMejora() { return oportunidadesMejora; }
    public void setOportunidadesMejora(List<String> oportunidadesMejora) { this.oportunidadesMejora = oportunidadesMejora; }

    public List<String> getRecomendaciones() { return recomendaciones; }
    public void setRecomendaciones(List<String> recomendaciones) { this.recomendaciones = recomendaciones; }

    public String getModeloVersion() { return modeloVersion; }
    public void setModeloVersion(String modeloVersion) { this.modeloVersion = modeloVersion; }
}
