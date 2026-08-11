package com.financeai.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "trivia_resultados")
public class TriviaResultado {

    @Id
    @GeneratedValue
    @Column(name = "id")
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(name = "pregunta_id", nullable = false, length = 40)
    private String preguntaId;

    @Column(name = "correcta", nullable = false)
    private boolean correcta;

    @Column(name = "respondido_at", nullable = false)
    private LocalDateTime respondidoAt;

    @PrePersist
    void marcarRespondido() {
        if (respondidoAt == null) respondidoAt = LocalDateTime.now();
    }

    public UUID getId() { return id; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getPreguntaId() { return preguntaId; }
    public void setPreguntaId(String preguntaId) { this.preguntaId = preguntaId; }
    public boolean isCorrecta() { return correcta; }
    public void setCorrecta(boolean correcta) { this.correcta = correcta; }
    public LocalDateTime getRespondidoAt() { return respondidoAt; }
}
