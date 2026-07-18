package com.financeai.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class TransaccionResponseDTO {
    private String id;
    private String descripcion;
    private BigDecimal monto;
    private String categoria;
    private LocalDate fecha;
    private String tipo;
    private String medioPago;
    private Boolean recurrente;

    public TransaccionResponseDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public BigDecimal getMonto() { return monto; }
    public void setMonto(BigDecimal monto) { this.monto = monto; }

    public String getCategoria() { return categoria; }
    public void setCategoria(String categoria) { this.categoria = categoria; }

    public LocalDate getFecha() { return fecha; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }

    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }

    public String getMedioPago() { return medioPago; }
    public void setMedioPago(String medioPago) { this.medioPago = medioPago; }

    public Boolean getRecurrente() { return recurrente; }
    public void setRecurrente(Boolean recurrente) { this.recurrente = recurrente; }
}
