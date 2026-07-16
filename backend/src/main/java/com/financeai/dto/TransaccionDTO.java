package com.financeai.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public class TransaccionDTO {

    @NotBlank(message = "La descripción es obligatoria")
    private String descripcion;

    @NotNull(message = "El monto es obligatorio")
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a 0")
    private BigDecimal valor;

    public TransaccionDTO() {}

    public TransaccionDTO(String descripcion, BigDecimal valor) {
        this.descripcion = descripcion;
        this.valor = valor;
    }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }
}
