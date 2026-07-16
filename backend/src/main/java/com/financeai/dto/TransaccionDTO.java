package com.financeai.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public class TransaccionDTO {

    @NotBlank(message = "La descripción es obligatoria")
    private String descripcion;

    @NotNull(message = "El monto es obligatorio")
    @DecimalMin(value = "0.01", message = "El monto debe ser mayor a 0")
    private BigDecimal valor;

    // ---- Campos OPCIONALES que enriquecen la llamada al modelo de ML ----
    // El front actual puede seguir enviando solo {descripcion, valor}; estos
    // se completan con valores por defecto si no vienen.

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
    private LocalDate fecha;

    private String medioPago;

    private String recurrente;

    public TransaccionDTO() {}

    public TransaccionDTO(String descripcion, BigDecimal valor) {
        this.descripcion = descripcion;
        this.valor = valor;
    }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor = valor; }

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }

    public String getMedioPago() { return medioPago; }
    public void setMedioPago(String medioPago) { this.medioPago = medioPago; }

    public String getRecurrente() { return recurrente; }
    public void setRecurrente(String recurrente) { this.recurrente = recurrente; }
}
