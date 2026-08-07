package com.financeai.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "logros_desbloqueados",
    uniqueConstraints = @UniqueConstraint(name = "uk_logro_por_usuario", columnNames = {"usuario_id", "logro_id"})
)
public class LogroDesbloqueado {

    @Id
    @GeneratedValue
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "logro_id", nullable = false, length = 60)
    private String logroId;

    @Column(name = "desbloqueado_at", nullable = false)
    private LocalDateTime desbloqueadoAt;

    @PrePersist
    void marcarDesbloqueo() {
        if (desbloqueadoAt == null) desbloqueadoAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getLogroId() { return logroId; }
    public void setLogroId(String logroId) { this.logroId = logroId; }
    public LocalDateTime getDesbloqueadoAt() { return desbloqueadoAt; }
}
