package com.financeai.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "gamificacion_estado")
public class EstadoGamificacion {

    @Id
    @Column(name = "usuario_id", length = 10)
    private String usuarioId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(name = "week_key", length = 10)
    private String weekKey;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "challenges_baseline", columnDefinition = "jsonb")
    private String challengesBaseline;

    @Column(name = "streak", nullable = false)
    private int streak;

    @Column(name = "best_streak", nullable = false)
    private int bestStreak;

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate;

    @Column(name = "daily_streak", nullable = false)
    private int dailyStreak;

    @Column(name = "best_daily_streak", nullable = false)
    private int bestDailyStreak;

    @Column(name = "best_level_seen", nullable = false)
    private int bestLevelSeen;

    @Column(name = "ultima_subida_nivel")
    private LocalDateTime ultimaSubidaNivel;

    @Column(name = "puntos", nullable = false)
    private int puntos;

    @Column(name = "mensajes_asistente", nullable = false)
    private int mensajesAsistente;

    @Column(name = "actualizado_at", nullable = false)
    private LocalDateTime actualizadoAt;

    @PrePersist
    @PreUpdate
    void marcarActualizacion() {
        actualizadoAt = LocalDateTime.now();
    }

    public String getUsuarioId() { return usuarioId; }
    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }
    public String getWeekKey() { return weekKey; }
    public void setWeekKey(String weekKey) { this.weekKey = weekKey; }
    public String getChallengesBaseline() { return challengesBaseline; }
    public void setChallengesBaseline(String challengesBaseline) { this.challengesBaseline = challengesBaseline; }
    public int getStreak() { return streak; }
    public void setStreak(int streak) { this.streak = streak; }
    public int getBestStreak() { return bestStreak; }
    public void setBestStreak(int bestStreak) { this.bestStreak = bestStreak; }
    public LocalDate getLastActiveDate() { return lastActiveDate; }
    public void setLastActiveDate(LocalDate lastActiveDate) { this.lastActiveDate = lastActiveDate; }
    public int getDailyStreak() { return dailyStreak; }
    public void setDailyStreak(int dailyStreak) { this.dailyStreak = dailyStreak; }
    public int getBestDailyStreak() { return bestDailyStreak; }
    public void setBestDailyStreak(int bestDailyStreak) { this.bestDailyStreak = bestDailyStreak; }
    public int getBestLevelSeen() { return bestLevelSeen; }
    public void setBestLevelSeen(int bestLevelSeen) { this.bestLevelSeen = bestLevelSeen; }
    public LocalDateTime getUltimaSubidaNivel() { return ultimaSubidaNivel; }
    public void setUltimaSubidaNivel(LocalDateTime ultimaSubidaNivel) { this.ultimaSubidaNivel = ultimaSubidaNivel; }
    public int getPuntos() { return puntos; }
    public void setPuntos(int puntos) { this.puntos = puntos; }
    public int getMensajesAsistente() { return mensajesAsistente; }
    public void setMensajesAsistente(int mensajesAsistente) { this.mensajesAsistente = mensajesAsistente; }
    public LocalDateTime getActualizadoAt() { return actualizadoAt; }
}
