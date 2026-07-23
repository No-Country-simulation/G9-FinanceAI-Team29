package com.financeai.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "perfiles_historial")
@CrossOrigin(origins = "*")
public class PerfilHistorial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", referencedColumnName = "id")
    private Usuario usuario;

    @Column(name = "perfil_predicho", length = 30)
    private String perfilPredicho;

    @Column(name = "perfil_real", length = 30)
    private String perfilReal;

    @Column(name = "probabilidad", precision = 5, scale = 4)
    private BigDecimal probabilidad;

    @Column(name = "fecha_analisis")
    private LocalDateTime fechaAnalisis;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detalles", columnDefinition = "jsonb")
    private String detalles;

    public PerfilHistorial() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }

    public String getPerfilPredicho() { return perfilPredicho; }
    public void setPerfilPredicho(String perfilPredicho) { this.perfilPredicho = perfilPredicho; }

    public String getPerfilReal() { return perfilReal; }
    public void setPerfilReal(String perfilReal) { this.perfilReal = perfilReal; }

    public BigDecimal getProbabilidad() { return probabilidad; }
    public void setProbabilidad(BigDecimal probabilidad) { this.probabilidad = probabilidad; }

    public LocalDateTime getFechaAnalisis() { return fechaAnalisis; }
    public void setFechaAnalisis(LocalDateTime fechaAnalisis) { this.fechaAnalisis = fechaAnalisis; }

    public String getDetalles() { return detalles; }
    public void setDetalles(String detalles) { this.detalles = detalles; }
}
