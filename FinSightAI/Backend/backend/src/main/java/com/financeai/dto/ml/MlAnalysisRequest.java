package com.financeai.dto.ml;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

/**
 * Lo que le mandamos al POST /analysis del ML.
 * Los nombres van en snake_case para que casen con lo que espera el FastAPI.
 */
public class MlAnalysisRequest {

    @JsonProperty("usuario_id")
    private String usuarioId;

    @JsonProperty("ingreso_mensual")
    private BigDecimal ingresoMensual;

    @JsonProperty("deuda_mensual")
    private BigDecimal deudaMensual;

    @JsonProperty("gasto_mensual_promedio")
    private BigDecimal gastoMensualPromedio;

    @JsonProperty("ahorro_mensual_estimado")
    private BigDecimal ahorroMensualEstimado;

    @JsonProperty("nivel_endeudamiento")
    private BigDecimal nivelEndeudamiento;

    @JsonProperty("porcentaje_gastos_ingreso")
    private BigDecimal porcentajeGastosIngreso;

    @JsonProperty("frecuencia_ahorro")
    private String frecuenciaAhorro;

    @JsonProperty("transacciones")
    private List<MlTransaccion> transacciones;

    public String getUsuarioId() { return usuarioId; }
    public void setUsuarioId(String usuarioId) { this.usuarioId = usuarioId; }

    public BigDecimal getIngresoMensual() { return ingresoMensual; }
    public void setIngresoMensual(BigDecimal ingresoMensual) { this.ingresoMensual = ingresoMensual; }

    public BigDecimal getDeudaMensual() { return deudaMensual; }
    public void setDeudaMensual(BigDecimal deudaMensual) { this.deudaMensual = deudaMensual; }

    public BigDecimal getGastoMensualPromedio() { return gastoMensualPromedio; }
    public void setGastoMensualPromedio(BigDecimal gastoMensualPromedio) { this.gastoMensualPromedio = gastoMensualPromedio; }

    public BigDecimal getAhorroMensualEstimado() { return ahorroMensualEstimado; }
    public void setAhorroMensualEstimado(BigDecimal ahorroMensualEstimado) { this.ahorroMensualEstimado = ahorroMensualEstimado; }

    public BigDecimal getNivelEndeudamiento() { return nivelEndeudamiento; }
    public void setNivelEndeudamiento(BigDecimal nivelEndeudamiento) { this.nivelEndeudamiento = nivelEndeudamiento; }

    public BigDecimal getPorcentajeGastosIngreso() { return porcentajeGastosIngreso; }
    public void setPorcentajeGastosIngreso(BigDecimal porcentajeGastosIngreso) { this.porcentajeGastosIngreso = porcentajeGastosIngreso; }

    public String getFrecuenciaAhorro() { return frecuenciaAhorro; }
    public void setFrecuenciaAhorro(String frecuenciaAhorro) { this.frecuenciaAhorro = frecuenciaAhorro; }

    public List<MlTransaccion> getTransacciones() { return transacciones; }
    public void setTransacciones(List<MlTransaccion> transacciones) { this.transacciones = transacciones; }
}
