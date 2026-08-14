package com.financeai.repository;
import com.financeai.model.Goal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
public interface GoalRepository extends JpaRepository<Goal, String> {
    List<Goal> findByUsuarioIdOrderByFechaCreacionDesc(String usuarioId);
    List<Goal> findByUsuarioIdAndEstadoOrderByFechaCreacionDesc(String usuarioId, String estado);
    List<Goal> findByEstadoAndFechaObjetivo(String estado, LocalDate fechaObjetivo);
}
