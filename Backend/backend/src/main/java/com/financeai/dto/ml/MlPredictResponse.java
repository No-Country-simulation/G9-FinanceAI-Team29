package com.financeai.dto.ml;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/**
 * Lo que devuelve el POST /predict/category del ML.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class MlPredictResponse {

    @JsonProperty("categoria_predicha")
    private String categoriaPredicha;

    @JsonProperty("confianza")
    private BigDecimal confianza;

    public String getCategoriaPredicha() { return categoriaPredicha; }
    public void setCategoriaPredicha(String categoriaPredicha) { this.categoriaPredicha = categoriaPredicha; }

    public BigDecimal getConfianza() { return confianza; }
    public void setConfianza(BigDecimal confianza) { this.confianza = confianza; }
}
