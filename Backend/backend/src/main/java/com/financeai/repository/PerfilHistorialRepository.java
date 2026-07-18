package com.financeai.repository;

import com.financeai.model.PerfilHistorial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PerfilHistorialRepository extends JpaRepository<PerfilHistorial, Long> {
    List<PerfilHistorial> findByUsuarioIdOrderByFechaAnalisisDesc(String usuarioId);
}
