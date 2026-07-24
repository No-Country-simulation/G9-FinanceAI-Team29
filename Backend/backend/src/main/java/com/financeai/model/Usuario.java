package com.financeai.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "usuarios")
public class Usuario {
    // datos de la tabla usuario
    @Id
    @Column(name = "id", length = 10)
    private String id;

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

    //agregamos campos necesarios de auth.users
    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "auth_user_id", length = 36)
    private String authUserId;

    public Usuario() {}

    public Usuario(String id, BigDecimal ingresoMensual, BigDecimal deudaMensual,
                   BigDecimal nivelEndeudamiento, String frecuenciaAhorro, String perfilFinanciero) {
        this.id = id;
        this.ingresoMensual = ingresoMensual;
        this.deudaMensual = deudaMensual;
        this.nivelEndeudamiento = nivelEndeudamiento;
        this.frecuenciaAhorro = frecuenciaAhorro;
        this.perfilFinanciero = perfilFinanciero;
        this.fechaRegistro = LocalDateTime.now();
        this.activo = true;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public BigDecimal getIngresoMensual() { return ingresoMensual; }
    public void setIngresoMensual(BigDecimal ingresoMensual) { this.ingresoMensual = ingresoMensual; }

    public BigDecimal getDeudaMensual() { return deudaMensual; }
    public void setDeudaMensual(BigDecimal deudaMensual) { this.deudaMensual = deudaMensual; }

    public BigDecimal getNivelEndeudamiento() { return nivelEndeudamiento; }
    public void setNivelEndeudamiento(BigDecimal nivelEndeudamiento) { this.nivelEndeudamiento = nivelEndeudamiento; }

    public BigDecimal getGastoMensualPromedio() { return gastoMensualPromedio; }
    public void setGastoMensualPromedio(BigDecimal gastoMensualPromedio) { this.gastoMensualPromedio = gastoMensualPromedio; }

    public BigDecimal getAhorroMensualEstimado() { return ahorroMensualEstimado; }
    public void setAhorroMensualEstimado(BigDecimal ahorroMensualEstimado) { this.ahorroMensualEstimado = ahorroMensualEstimado; }

    public BigDecimal getPorcentajeGastosIngreso() { return porcentajeGastosIngreso; }
    public void setPorcentajeGastosIngreso(BigDecimal porcentajeGastosIngreso) { this.porcentajeGastosIngreso = porcentajeGastosIngreso; }

    public String getFrecuenciaAhorro() { return frecuenciaAhorro; }
    public void setFrecuenciaAhorro(String frecuenciaAhorro) { this.frecuenciaAhorro = frecuenciaAhorro; }

    public String getPerfilFinanciero() { return perfilFinanciero; }
    public void setPerfilFinanciero(String perfilFinanciero) { this.perfilFinanciero = perfilFinanciero; }

    public LocalDateTime getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(LocalDateTime fechaRegistro) { this.fechaRegistro = fechaRegistro; }

    public String getAuthUserId() {return authUserId; }
    public void setAuthUserId(String authUserId) { this.authUserId = authUserId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Boolean getActivo() { return activo; }
    public void setActivo(Boolean activo) { this.activo = activo; }
}
