package com.financeai.dto.ml;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/**
 * La transacción en el formato que espera el ML (snake_case).
 * La uso tanto en /analysis como (en parte) en /predict/category.
 */
public class MlTransaccion {

    @JsonProperty("fecha")
    private String fecha; // formato yyyy-MM-dd

    @JsonProperty("descripcion")
    private String descripcion;

    @JsonProperty("monto")
    private BigDecimal monto;

    @JsonProperty("categoria")
    private String categoria;

    @JsonProperty("medio_pago")
    private String medioPago;

    @JsonProperty("recurrente")
    private String recurrente;

    public MlTransaccion() {}

    public MlTransaccion(String fecha, String descripcion, BigDecimal monto,
                         String categoria, String medioPago, String recurrente) {
        this.fecha = fecha;
        this.descripcion = descripcion;
        this.monto = monto;
        this.categoria = categoria;
        this.medioPago = medioPago;
        this.recurrente = recurrente;
    }

    public String getFecha() { return fecha; }
    public void setFecha(String fecha) { this.fecha = fecha; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public BigDecimal getMonto() { return monto; }
    public void setMonto(BigDecimal monto) { this.monto = monto; }

    public String getCategoria() { return categoria; }
    public void setCategoria(String categoria) { this.categoria = categoria; }

    public String getMedioPago() { return medioPago; }
    public void setMedioPago(String medioPago) { this.medioPago = medioPago; }

    public String getRecurrente() { return recurrente; }
    public void setRecurrente(String recurrente) { this.recurrente = recurrente; }
}
