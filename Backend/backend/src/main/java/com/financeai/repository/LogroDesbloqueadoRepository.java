package com.financeai.repository;

import com.financeai.model.LogroDesbloqueado;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LogroDesbloqueadoRepository extends JpaRepository<LogroDesbloqueado, UUID> {
    List<LogroDesbloqueado> findByUsuarioId(String usuarioId);
    Optional<LogroDesbloqueado> findByUsuarioIdAndLogroId(String usuarioId, String logroId);
}
