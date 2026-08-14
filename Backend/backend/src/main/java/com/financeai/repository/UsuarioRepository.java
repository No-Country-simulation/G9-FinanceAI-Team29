package com.financeai.repository;

import com.financeai.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, String> {

    List<Usuario> findByPerfilFinanciero(String perfilFinanciero);

    List<Usuario> findByActivo(Boolean activo);

    boolean existsByEmailIgnoreCase(String email);

    Optional<Usuario> findByEmailIgnoreCase(String email);

    @Query(
            value = """
                    SELECT COALESCE(
                        MAX(CAST(SUBSTRING(id FROM 4) AS INTEGER)),
                        1000
                    )
                    FROM usuarios
                    WHERE id ~ '^USR[0-9]+$'
                    """,
            nativeQuery = true
    )
    Integer obtenerMaximoNumeroUsuario();
}
