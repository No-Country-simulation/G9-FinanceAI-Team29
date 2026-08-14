package com.financeai.repository;

import com.financeai.model.EstadoGamificacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;

public interface EstadoGamificacionRepository extends JpaRepository<EstadoGamificacion, String> {

    /**
     * Guarda el estado de forma atómica (INSERT o UPDATE en una sola sentencia de Postgres).
     *
     * <p>Evita la carrera que se daba con "find + save": dos requests concurrentes que no
     * encontraban la fila intentaban ambos un INSERT y el segundo chocaba con la PK
     * (usuario_id), ensuciando el log con {@code duplicate key ...}. Con {@code ON CONFLICT}
     * el segundo simplemente actualiza, sin excepción.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        INSERT INTO gamificacion_estado
            (usuario_id, week_key, challenges_baseline, streak, best_streak, last_active_date,
             daily_streak, best_daily_streak, best_level_seen, ultima_subida_nivel, puntos,
             mensajes_asistente, actualizado_at)
        VALUES
            (:usuarioId, :weekKey, CAST(:challengesBaseline AS jsonb), :streak, :bestStreak, :lastActiveDate,
             :dailyStreak, :bestDailyStreak, :bestLevelSeen, :ultimaSubidaNivel, :puntos,
             :mensajesAsistente, now())
        ON CONFLICT (usuario_id) DO UPDATE SET
            week_key            = EXCLUDED.week_key,
            challenges_baseline = EXCLUDED.challenges_baseline,
            streak              = EXCLUDED.streak,
            best_streak         = EXCLUDED.best_streak,
            last_active_date    = EXCLUDED.last_active_date,
            daily_streak        = EXCLUDED.daily_streak,
            best_daily_streak   = EXCLUDED.best_daily_streak,
            best_level_seen     = EXCLUDED.best_level_seen,
            ultima_subida_nivel = EXCLUDED.ultima_subida_nivel,
            puntos              = EXCLUDED.puntos,
            mensajes_asistente  = EXCLUDED.mensajes_asistente,
            actualizado_at      = now()
        """, nativeQuery = true)
    void upsertEstado(
            @Param("usuarioId") String usuarioId,
            @Param("weekKey") String weekKey,
            @Param("challengesBaseline") String challengesBaseline,
            @Param("streak") int streak,
            @Param("bestStreak") int bestStreak,
            @Param("lastActiveDate") LocalDate lastActiveDate,
            @Param("dailyStreak") int dailyStreak,
            @Param("bestDailyStreak") int bestDailyStreak,
            @Param("bestLevelSeen") int bestLevelSeen,
            @Param("ultimaSubidaNivel") LocalDateTime ultimaSubidaNivel,
            @Param("puntos") int puntos,
            @Param("mensajesAsistente") int mensajesAsistente
    );
}
