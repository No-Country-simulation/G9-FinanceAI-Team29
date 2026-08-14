package com.financeai.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "retos_progreso",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_reto_por_usuario_semana",
        columnNames = {"usuario_id", "reto_id", "semana_iso"})
)
public class RetoProgreso {

    @Id
    @GeneratedValue
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "reto_id", nullable = false, length = 60)
    private String retoId;

    @Column(name = "semana_iso", nullable = false, length = 10)
    private String semanaIso;

    @Column(name = "completado", nullable = false)
    private boolean completado = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "progreso", columnDefinition = "jsonb")
    private String progreso;

    @Column(name = "actualizado_at", nullable = false)
    private LocalDateTime actualizadoAt;

    @PrePersist
    @PreUpdate
    void marcarActualizacion() {
        actualizadoAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getRetoId() { return retoId; }
    public void setRetoId(String retoId) { this.retoId = retoId; }
    public String getSemanaIso() { return semanaIso; }
    public void setSemanaIso(String semanaIso) { this.semanaIso = semanaIso; }
    public boolean isCompletado() { return completado; }
    public void setCompletado(boolean completado) { this.completado = completado; }
    public String getProgreso() { return progreso; }
    public void setProgreso(String progreso) { this.progreso = progreso; }
    public LocalDateTime getActualizadoAt() { return actualizadoAt; }
}
