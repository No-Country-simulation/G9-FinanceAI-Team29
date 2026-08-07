package com.financeai.dto.ml;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/**
 * Respuesta del endpoint /predict/category del AI-Service.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class MlPredictResponse {

    @JsonProperty("categoria_predicha")
    private String categoriaPredicha;

    @JsonProperty("subcategoria_predicha")
    private String subcategoriaPredicha;

    @JsonProperty("confianza")
    private BigDecimal confianza;

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
}