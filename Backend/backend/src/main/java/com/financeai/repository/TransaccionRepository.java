package com.financeai.repository;

import com.financeai.model.Transaccion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface TransaccionRepository extends JpaRepository<Transaccion, String> {

    List<Transaccion> findByUsuarioId(String usuarioId);

    List<Transaccion> findByUsuarioIdAndFechaBetween(
        String usuarioId, LocalDate fechaInicio, LocalDate fechaFin);

    @Query("SELECT SUM(t.monto) FROM Transaccion t " +
           "WHERE t.usuario.id = :usuarioId AND t.tipo = 'Gasto' " +
           "AND t.fecha BETWEEN :fechaInicio AND :fechaFin")
    BigDecimal sumGastosByUsuarioAndPeriodo(
        @Param("usuarioId") String usuarioId,
        @Param("fechaInicio") LocalDate fechaInicio,
        @Param("fechaFin") LocalDate fechaFin);

    @Query("SELECT t.categoria.nombre, SUM(t.monto) FROM Transaccion t " +
           "WHERE t.usuario.id = :usuarioId AND t.tipo = 'Gasto' " +
           "AND t.fecha BETWEEN :fechaInicio AND :fechaFin " +
           "GROUP BY t.categoria.nombre")
    List<Object[]> sumGastosByCategoria(
        @Param("usuarioId") String usuarioId,
        @Param("fechaInicio") LocalDate fechaInicio,
        @Param("fechaFin") LocalDate fechaFin);

    @Query("SELECT COUNT(t) FROM Transaccion t " +
           "WHERE t.usuario.id = :usuarioId AND t.categoria.nombre = :categoria " +
           "AND t.fecha BETWEEN :fechaInicio AND :fechaFin")
    Long countByCategoria(
        @Param("usuarioId") String usuarioId,
        @Param("categoria") String categoria,
        @Param("fechaInicio") LocalDate fechaInicio,
        @Param("fechaFin") LocalDate fechaFin);
}
