package com.financeai.repository;

import com.financeai.model.RetoProgreso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RetoProgresoRepository extends JpaRepository<RetoProgreso, UUID> {
    List<RetoProgreso> findByUsuarioIdAndSemanaIso(String usuarioId, String semanaIso);
    Optional<RetoProgreso> findByUsuarioIdAndRetoIdAndSemanaIso(String usuarioId, String retoId, String semanaIso);
}
