package com.financeai.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @Column(name = "id", length = 10)
    private String id;

    @Column(name = "nombre", length = 80)
    private String nombre;

    @Column(name = "apellido", length = 80)
    private String apellido;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "auth_user_id", length = 36)
    private String authUserId;

    @Column(name = "ingreso_mensual", precision = 12, scale = 2)
    private BigDecimal ingresoMensual;

    @Column(name = "deuda_mensual", precision = 12, scale = 2)
    private BigDecimal deudaMensual;

    @Column(name = "nivel_endeudamiento", precision = 5, scale = 2)
    private BigDecimal nivelEndeudamiento;

    @Column(name = "gasto_mensual_promedio", precision = 12, scale = 2)
    private BigDecimal gastoMensualPromedio;

    @Column(name = "ahorro_mensual_estimado", precision = 12, scale = 2)
    private BigDecimal ahorroMensualEstimado;

    @Column(name = "porcentaje_gastos_ingreso", precision = 5, scale = 2)
    private BigDecimal porcentajeGastosIngreso;

    @Column(name = "frecuencia_ahorro", length = 20)
    private String frecuenciaAhorro;

    @Column(name = "perfil_financiero", length = 30)
    private String perfilFinanciero;

    @Column(name = "fecha_registro")
    private LocalDateTime fechaRegistro;

    @Column(name = "activo")
    private Boolean activo = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", length = 20)
    private EstadoUsuario estado = EstadoUsuario.ACTIVO;

    @Column(name = "ultima_actividad")
    private LocalDateTime ultimaActividad;

    @Column(name = "fecha_eliminacion")
    private LocalDateTime fechaEliminacion;

    public Usuario() {
    }

    public Usuario(
            String id,
            BigDecimal ingresoMensual,
            BigDecimal deudaMensual,
            BigDecimal nivelEndeudamiento,
            String frecuenciaAhorro,
            String perfilFinanciero
    ) {
        this.id = id;
        this.ingresoMensual = ingresoMensual;
        this.deudaMensual = deudaMensual;
        this.nivelEndeudamiento = nivelEndeudamiento;
        this.frecuenciaAhorro = frecuenciaAhorro;
        this.perfilFinanciero = perfilFinanciero;
        this.fechaRegistro = LocalDateTime.now();
        this.activo = true;
        this.estado = EstadoUsuario.ACTIVO;
        this.ultimaActividad = LocalDateTime.now();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getApellido() {
        return apellido;
    }

    public void setApellido(String apellido) {
        this.apellido = apellido;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getAuthUserId() {
        return authUserId;
    }

    public void setAuthUserId(String authUserId) {
        this.authUserId = authUserId;
    }

    public BigDecimal getIngresoMensual() {
        return ingresoMensual;
    }

    public void setIngresoMensual(BigDecimal ingresoMensual) {
        this.ingresoMensual = ingresoMensual;
    }

    public BigDecimal getDeudaMensual() {
        return deudaMensual;
    }

    public void setDeudaMensual(BigDecimal deudaMensual) {
        this.deudaMensual = deudaMensual;
    }

    public BigDecimal getNivelEndeudamiento() {
        return nivelEndeudamiento;
    }

    public void setNivelEndeudamiento(BigDecimal nivelEndeudamiento) {
        this.nivelEndeudamiento = nivelEndeudamiento;
    }

    public BigDecimal getGastoMensualPromedio() {
        return gastoMensualPromedio;
    }

    public void setGastoMensualPromedio(BigDecimal gastoMensualPromedio) {
        this.gastoMensualPromedio = gastoMensualPromedio;
    }

    public BigDecimal getAhorroMensualEstimado() {
        return ahorroMensualEstimado;
    }

    public void setAhorroMensualEstimado(BigDecimal ahorroMensualEstimado) {
        this.ahorroMensualEstimado = ahorroMensualEstimado;
    }

    public BigDecimal getPorcentajeGastosIngreso() {
        return porcentajeGastosIngreso;
    }

    public void setPorcentajeGastosIngreso(BigDecimal porcentajeGastosIngreso) {
        this.porcentajeGastosIngreso = porcentajeGastosIngreso;
    }

    public String getFrecuenciaAhorro() {
        return frecuenciaAhorro;
    }

    public void setFrecuenciaAhorro(String frecuenciaAhorro) {
        this.frecuenciaAhorro = frecuenciaAhorro;
    }

    public String getPerfilFinanciero() {
        return perfilFinanciero;
    }

    public void setPerfilFinanciero(String perfilFinanciero) {
        this.perfilFinanciero = perfilFinanciero;
    }

    public LocalDateTime getFechaRegistro() {
        return fechaRegistro;
    }

    public void setFechaRegistro(LocalDateTime fechaRegistro) {
        this.fechaRegistro = fechaRegistro;
    }

    public Boolean getActivo() {
        return activo;
    }

    public void setActivo(Boolean activo) {
        this.activo = activo;
    }

    public EstadoUsuario getEstado() {
        return estado != null ? estado : (Boolean.FALSE.equals(activo) ? EstadoUsuario.ELIMINADO : EstadoUsuario.ACTIVO);
    }

    public void setEstado(EstadoUsuario estado) {
        this.estado = estado;
        this.activo = estado != EstadoUsuario.ELIMINADO;
    }

    public LocalDateTime getUltimaActividad() {
        return ultimaActividad;
    }

    public void setUltimaActividad(LocalDateTime ultimaActividad) {
        this.ultimaActividad = ultimaActividad;
    }

    public LocalDateTime getFechaEliminacion() {
        return fechaEliminacion;
    }

    public void setFechaEliminacion(LocalDateTime fechaEliminacion) {
        this.fechaEliminacion = fechaEliminacion;
    }

    @PrePersist
    @PreUpdate
    private void normalizarEstado() {
        if (estado == null) {
            estado = Boolean.FALSE.equals(activo) ? EstadoUsuario.ELIMINADO : EstadoUsuario.ACTIVO;
        }
        activo = estado != EstadoUsuario.ELIMINADO;
        if (ultimaActividad == null && estado != EstadoUsuario.ELIMINADO) {
            ultimaActividad = LocalDateTime.now();
        }
    }
}

