package com.financeai.dto.csv;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class CsvImportResponse {
    private boolean valido;
    private UsuarioCsv usuario;
    private List<TransaccionCsv> transacciones;
    private ResumenCsv resumen;

    public boolean isValido() { return valido; }
    public void setValido(boolean valido) { this.valido = valido; }
    public UsuarioCsv getUsuario() { return usuario; }
    public void setUsuario(UsuarioCsv usuario) { this.usuario = usuario; }
    public List<TransaccionCsv> getTransacciones() { return transacciones; }
    public void setTransacciones(List<TransaccionCsv> transacciones) { this.transacciones = transacciones; }
    public ResumenCsv getResumen() { return resumen; }
    public void setResumen(ResumenCsv resumen) { this.resumen = resumen; }

    public static class UsuarioCsv {
        @JsonProperty("usuario_id") private String usuarioId;
        @JsonProperty("ingreso_mensual") private BigDecimal ingresoMensual;
        @JsonProperty("gasto_mensual_promedio") private BigDecimal gastoMensualPromedio;
        @JsonProperty("deuda_mensual") private BigDecimal deudaMensual;
        @JsonProperty("ahorro_mensual_estimado") private BigDecimal ahorroMensualEstimado;
        @JsonProperty("porcentaje_gastos_ingreso") private BigDecimal porcentajeGastosIngreso;
        @JsonProperty("nivel_endeudamiento") private BigDecimal nivelEndeudamiento;
        @JsonProperty("porcentaje_ahorro_ingreso") private BigDecimal porcentajeAhorroIngreso;
        @JsonProperty("frecuencia_ahorro") private String frecuenciaAhorro;
        @JsonProperty("perfil_financiero") private String perfilFinanciero;
        private String estado;

        public String getUsuarioId() { return usuarioId; }
        public void setUsuarioId(String usuarioId) { this.usuarioId = usuarioId; }
        public BigDecimal getIngresoMensual() { return ingresoMensual; }
        public void setIngresoMensual(BigDecimal ingresoMensual) { this.ingresoMensual = ingresoMensual; }
        public BigDecimal getGastoMensualPromedio() { return gastoMensualPromedio; }
        public void setGastoMensualPromedio(BigDecimal gastoMensualPromedio) { this.gastoMensualPromedio = gastoMensualPromedio; }
        public BigDecimal getDeudaMensual() { return deudaMensual; }
        public void setDeudaMensual(BigDecimal deudaMensual) { this.deudaMensual = deudaMensual; }
        public BigDecimal getAhorroMensualEstimado() { return ahorroMensualEstimado; }
        public void setAhorroMensualEstimado(BigDecimal ahorroMensualEstimado) { this.ahorroMensualEstimado = ahorroMensualEstimado; }
        public BigDecimal getPorcentajeGastosIngreso() { return porcentajeGastosIngreso; }
        public void setPorcentajeGastosIngreso(BigDecimal porcentajeGastosIngreso) { this.porcentajeGastosIngreso = porcentajeGastosIngreso; }
        public BigDecimal getNivelEndeudamiento() { return nivelEndeudamiento; }
        public void setNivelEndeudamiento(BigDecimal nivelEndeudamiento) { this.nivelEndeudamiento = nivelEndeudamiento; }
        public BigDecimal getPorcentajeAhorroIngreso() { return porcentajeAhorroIngreso; }
        public void setPorcentajeAhorroIngreso(BigDecimal porcentajeAhorroIngreso) { this.porcentajeAhorroIngreso = porcentajeAhorroIngreso; }
        public String getFrecuenciaAhorro() { return frecuenciaAhorro; }
        public void setFrecuenciaAhorro(String frecuenciaAhorro) { this.frecuenciaAhorro = frecuenciaAhorro; }
        public String getPerfilFinanciero() { return perfilFinanciero; }
        public void setPerfilFinanciero(String perfilFinanciero) { this.perfilFinanciero = perfilFinanciero; }
        public String getEstado() { return estado; }
        public void setEstado(String estado) { this.estado = estado; }
    }

    public static class TransaccionCsv {
        @JsonProperty("transaction_id") private String transactionId;
        @JsonProperty("usuario_id") private String usuarioId;
        private LocalDate fecha;
        private String descripcion;
        private BigDecimal monto;
        private String moneda;
        private String tipo;
        private String categoria;
        @JsonProperty("medio_pago") private String medioPago;
        private Boolean recurrente;
        private String origen;

        public String getTransactionId() { return transactionId; }
        public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
        public String getUsuarioId() { return usuarioId; }
        public void setUsuarioId(String usuarioId) { this.usuarioId = usuarioId; }
        public LocalDate getFecha() { return fecha; }
        public void setFecha(LocalDate fecha) { this.fecha = fecha; }
        public String getDescripcion() { return descripcion; }
        public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
        public BigDecimal getMonto() { return monto; }
        public void setMonto(BigDecimal monto) { this.monto = monto; }
        public String getMoneda() { return moneda; }
        public void setMoneda(String moneda) { this.moneda = moneda; }
        public String getTipo() { return tipo; }
        public void setTipo(String tipo) { this.tipo = tipo; }
        public String getCategoria() { return categoria; }
        public void setCategoria(String categoria) { this.categoria = categoria; }
        public String getMedioPago() { return medioPago; }
        public void setMedioPago(String medioPago) { this.medioPago = medioPago; }
        public Boolean getRecurrente() { return recurrente; }
        public void setRecurrente(Boolean recurrente) { this.recurrente = recurrente; }
        public String getOrigen() { return origen; }
        public void setOrigen(String origen) { this.origen = origen; }
    }

    public static class ResumenCsv {
        @JsonProperty("cantidad_transacciones") private Integer cantidadTransacciones;
        @JsonProperty("cantidad_meses") private Integer cantidadMeses;
        @JsonProperty("total_ingresos") private BigDecimal totalIngresos;
        @JsonProperty("total_gastos") private BigDecimal totalGastos;
        private String moneda;

        public Integer getCantidadTransacciones() { return cantidadTransacciones; }
        public void setCantidadTransacciones(Integer cantidadTransacciones) { this.cantidadTransacciones = cantidadTransacciones; }
        public Integer getCantidadMeses() { return cantidadMeses; }
        public void setCantidadMeses(Integer cantidadMeses) { this.cantidadMeses = cantidadMeses; }
        public BigDecimal getTotalIngresos() { return totalIngresos; }
        public void setTotalIngresos(BigDecimal totalIngresos) { this.totalIngresos = totalIngresos; }
        public BigDecimal getTotalGastos() { return totalGastos; }
        public void setTotalGastos(BigDecimal totalGastos) { this.totalGastos = totalGastos; }
        public String getMoneda() { return moneda; }
        public void setMoneda(String moneda) { this.moneda = moneda; }
    }
}
