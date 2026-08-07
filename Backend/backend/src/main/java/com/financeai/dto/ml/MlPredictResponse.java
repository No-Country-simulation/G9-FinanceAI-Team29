package com.financeai.dto.ml;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Lo que devuelve el POST /predict/category del ML.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class MlPredictResponse {

    @JsonProperty("tipo_transaccion")
    private String tipoTransaccion;

    @JsonProperty("categoria_predicha")
    private String categoriaPredicha;

    @JsonProperty("subcategoria_predicha")
    private String subcategoriaPredicha;

    @JsonProperty("confianza")
    private BigDecimal confianza;

    @JsonProperty("metodo_clasificacion")
    private String metodoClasificacion;

    @JsonProperty("advertencias")
    private List<String> advertencias;

    @JsonProperty("modelo_version")
    private String modeloVersion;

    public String getTipoTransaccion() {
        return tipoTransaccion;
    }

    public void setTipoTransaccion(String tipoTransaccion) {
        this.tipoTransaccion = tipoTransaccion;
    }

    public String getCategoriaPredicha() {
        return categoriaPredicha;
    }

    public void setCategoriaPredicha(String categoriaPredicha) {
        this.categoriaPredicha = categoriaPredicha;
    }

    public String getSubcategoriaPredicha() {
        return subcategoriaPredicha;
    }

    public void setSubcategoriaPredicha(String subcategoriaPredicha) {
        this.subcategoriaPredicha = subcategoriaPredicha;
    }

    public BigDecimal getConfianza() {
        return confianza;
    }

    public void setConfianza(BigDecimal confianza) {
        this.confianza = confianza;
    }

    public String getMetodoClasificacion() {
        return metodoClasificacion;
    }

    public void setMetodoClasificacion(String metodoClasificacion) {
        this.metodoClasificacion = metodoClasificacion;
    }

    public List<String> getAdvertencias() {
        return advertencias;
    }

    public void setAdvertencias(List<String> advertencias) {
        this.advertencias = advertencias;
    }

    public String getModeloVersion() {
        return modeloVersion;
    }

    public void setModeloVersion(String modeloVersion) {
        this.modeloVersion = modeloVersion;
    }
}