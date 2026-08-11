package com.financeai.repository;

import com.financeai.model.TriviaResultado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface TriviaResultadoRepository extends JpaRepository<TriviaResultado, UUID> {
    List<TriviaResultado> findByUsuarioIdAndRespondidoAtBetween(String usuarioId, LocalDateTime desde, LocalDateTime hasta);
    List<TriviaResultado> findByUsuarioIdOrderByRespondidoAtDesc(String usuarioId);
}
