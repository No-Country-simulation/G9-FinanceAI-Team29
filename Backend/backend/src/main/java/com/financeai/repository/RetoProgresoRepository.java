package com.financeai.repository;

import com.financeai.model.RetoProgreso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RetoProgresoRepository extends JpaRepository<RetoProgreso, UUID> {
    List<RetoProgreso> findByUsuarioIdAndSemanaIso(String usuarioId, String semanaIso);
    Optional<RetoProgreso> findByUsuarioIdAndRetoIdAndSemanaIso(String usuarioId, String retoId, String semanaIso);

    /**
     * Guarda el progreso de un reto de forma atómica (INSERT o UPDATE en una sola sentencia).
     *
     * <p>Evita la carrera del "find + save": sin la constraint única dos requests concurrentes
     * creaban filas DUPLICADAS (que después rompían las lecturas con NonUniqueResult); con
     * {@code ON CONFLICT} sobre {@code uk_reto_por_usuario_semana} el segundo simplemente
     * actualiza, sin excepción ni ruido en el log.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        INSERT INTO retos_progreso
            (id, usuario_id, reto_id, semana_iso, completado, progreso, actualizado_at)
        VALUES
            (gen_random_uuid(), :usuarioId, :retoId, :semanaIso, :completado, CAST(:progreso AS jsonb), now())
        ON CONFLICT (usuario_id, reto_id, semana_iso) DO UPDATE SET
            completado     = EXCLUDED.completado,
            progreso       = EXCLUDED.progreso,
            actualizado_at = now()
        """, nativeQuery = true)
    void upsertReto(
            @Param("usuarioId") String usuarioId,
            @Param("retoId") String retoId,
            @Param("semanaIso") String semanaIso,
            @Param("completado") boolean completado,
            @Param("progreso") String progreso
    );
}
