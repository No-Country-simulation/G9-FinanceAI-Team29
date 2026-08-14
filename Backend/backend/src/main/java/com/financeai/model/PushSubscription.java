package com.financeai.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Suscripción de Web Push del navegador de un usuario (reemplaza la tabla que manejaban
 * las funciones serverless de Vercel). Sirve para enviarle recordatorios aunque no tenga
 * la app abierta. El {@code endpoint} es único (una fila por navegador/dispositivo).
 */
@Entity
@Table(
    name = "push_subscriptions",
    uniqueConstraints = @UniqueConstraint(name = "uk_push_endpoint", columnNames = "endpoint")
)
public class PushSubscription {

    @Id
    @GeneratedValue
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "endpoint", nullable = false, columnDefinition = "text")
    private String endpoint;

    @Column(name = "p256dh", nullable = false, columnDefinition = "text")
    private String p256dh;

    @Column(name = "auth", nullable = false, columnDefinition = "text")
    private String auth;

    @Column(name = "creado_at", nullable = false)
    private LocalDateTime creadoAt;

    @PrePersist
    void marcarCreacion() {
        creadoAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    public String getP256dh() { return p256dh; }
    public void setP256dh(String p256dh) { this.p256dh = p256dh; }
    public String getAuth() { return auth; }
    public void setAuth(String auth) { this.auth = auth; }
    public LocalDateTime getCreadoAt() { return creadoAt; }
}
