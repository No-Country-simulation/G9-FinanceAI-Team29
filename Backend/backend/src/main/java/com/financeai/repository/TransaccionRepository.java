package com.financeai.repository;

import com.financeai.model.Transaccion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    // Variante paginada: trae las transacciones de a "páginas" (page/size/orden).
    Page<Transaccion> findByUsuarioId(String usuarioId, Pageable pageable);

    void deleteByUsuarioId(String usuarioId);

    void deleteByUsuarioIdAndFechaBetween(
            String usuarioId,
            LocalDate fechaInicio,
            LocalDate fechaFin
    );

    long countByUsuarioId(String usuarioId);

    long countByUsuarioIdAndFechaBetween(
            String usuarioId,
            LocalDate fechaInicio,
            LocalDate fechaFin
    );

    List<Transaccion> findByUsuarioIdAndFechaBetween(
            String usuarioId,
            LocalDate fechaInicio,
            LocalDate fechaFin
    );

    @Query(
            "SELECT SUM(t.monto) FROM Transaccion t " +
            "WHERE t.usuario.id = :usuarioId AND t.tipo = 'Gasto' " +
            "AND t.fecha BETWEEN :fechaInicio AND :fechaFin"
    )
    BigDecimal sumGastosByUsuarioAndPeriodo(
            @Param("usuarioId") String usuarioId,
            @Param("fechaInicio") LocalDate fechaInicio,
            @Param("fechaFin") LocalDate fechaFin
    );

    @Query(
            "SELECT t.categoria.nombre, SUM(t.monto) FROM Transaccion t " +
            "WHERE t.usuario.id = :usuarioId AND t.tipo = 'Gasto' " +
            "AND t.fecha BETWEEN :fechaInicio AND :fechaFin " +
            "GROUP BY t.categoria.nombre"
    )
    List<Object[]> sumGastosByCategoria(
            @Param("usuarioId") String usuarioId,
            @Param("fechaInicio") LocalDate fechaInicio,
            @Param("fechaFin") LocalDate fechaFin
    );

    @Query(
            "SELECT COUNT(t) FROM Transaccion t " +
            "WHERE t.usuario.id = :usuarioId AND t.categoria.nombre = :categoria " +
            "AND t.fecha BETWEEN :fechaInicio AND :fechaFin"
    )
    Long countByCategoria(
            @Param("usuarioId") String usuarioId,
            @Param("categoria") String categoria,
            @Param("fechaInicio") LocalDate fechaInicio,
            @Param("fechaFin") LocalDate fechaFin
    );

    /**
     * Busca solamente gastos que todavía no tienen subcategoría.
     *
     * Los ingresos quedan afuera a propósito porque no necesitan subcategoría.
     * Pageable permite procesar la base en lotes chicos sin cargar todo en memoria.
     */
    @Query("""
            SELECT t
            FROM Transaccion t
            WHERE UPPER(t.tipo) = 'GASTO'
              AND t.subcategoria IS NULL
            ORDER BY t.usuario.id ASC, t.fecha ASC, t.id ASC
            """)
    List<Transaccion> findPendientesDeReclasificar(Pageable pageable);

    /**
     * Cantidad de gastos que todavía esperan reclasificación.
     */
    @Query("""
            SELECT COUNT(t)
            FROM Transaccion t
            WHERE UPPER(t.tipo) = 'GASTO'
              AND t.subcategoria IS NULL
            """)
    long countPendientesDeReclasificar();
}