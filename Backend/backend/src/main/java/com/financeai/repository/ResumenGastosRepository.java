package com.financeai.repository;

import com.financeai.model.ResumenGastos;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResumenGastosRepository extends JpaRepository<ResumenGastos, Long> {
    List<ResumenGastos> findByUsuarioId(String usuarioId);
}
