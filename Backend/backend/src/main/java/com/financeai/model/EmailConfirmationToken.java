package com.financeai.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Token de confirmación de email al registrarse. Guarda solo el hash SHA-256; el valor en claro
 * viaja únicamente en el enlace del email. Mismo criterio que {@link PasswordResetToken}.
 */
@Entity
@Table(name = "email_confirmation_tokens")
public class EmailConfirmationToken {

    @Id
    @GeneratedValue
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "expira_at", nullable = false)
    private LocalDateTime expiraAt;

    @Column(name = "usado", nullable = false)
    private boolean usado = false;

    @Column(name = "creado_at", nullable = false)
    private LocalDateTime creadoAt;

    @PrePersist
    void marcarCreacion() {
        creadoAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public LocalDateTime getExpiraAt() { return expiraAt; }
    public void setExpiraAt(LocalDateTime expiraAt) { this.expiraAt = expiraAt; }
    public boolean isUsado() { return usado; }
    public void setUsado(boolean usado) { this.usado = usado; }
    public LocalDateTime getCreadoAt() { return creadoAt; }
}
