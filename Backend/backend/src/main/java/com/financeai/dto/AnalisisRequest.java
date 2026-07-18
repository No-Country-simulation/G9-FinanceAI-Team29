package com.financeai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public class AnalisisRequest {

    @NotNull(message = "El ingreso mensual es obligatorio")
    @DecimalMin(value = "0.0", message = "El ingreso mensual debe ser positivo")
    private BigDecimal ingresoMensual;

    @NotNull(message = "El nivel de endeudamiento es obligatorio")
    @DecimalMin(value = "0.0", message = "El nivel de endeudamiento debe ser positivo")
    @DecimalMax(value = "100.0", message = "El nivel de endeudamiento no puede superar 100")
    private BigDecimal nivelEndeudamiento;

    @NotNull(message = "La frecuencia de ahorro es obligatoria")
    @Pattern(regexp = "^(Alta|Media|Baja|Nunca)$", message = "Frecuencia inválida: Alta, Media, Baja o Nunca")
    private String frecuenciaAhorro;

    @NotEmpty(message = "Debe incluir al menos una transacción")
    @Valid
    private List<TransaccionDTO> transacciones;

    public AnalisisRequest() {}

    public BigDecimal getIngresoMensual() { return ingresoMensual; }
    public void setIngresoMensual(BigDecimal ingresoMensual) { this.ingresoMensual = ingresoMensual; }

    public BigDecimal getNivelEndeudamiento() { return nivelEndeudamiento; }
    public void setNivelEndeudamiento(BigDecimal nivelEndeudamiento) { this.nivelEndeudamiento = nivelEndeudamiento; }

    public String getFrecuenciaAhorro() { return frecuenciaAhorro; }
    public void setFrecuenciaAhorro(String frecuenciaAhorro) { this.frecuenciaAhorro = frecuenciaAhorro; }

    public List<TransaccionDTO> getTransacciones() { return transacciones; }
    public void setTransacciones(List<TransaccionDTO> transacciones) { this.transacciones = transacciones; }
}
