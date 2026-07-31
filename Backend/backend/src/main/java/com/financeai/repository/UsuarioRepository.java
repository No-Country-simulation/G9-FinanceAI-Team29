package com.financeai.repository;

import com.financeai.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, String> {

    List<Usuario> findByPerfilFinanciero(String perfilFinanciero);

    List<Usuario> findByActivo(Boolean activo);

    Optional<Usuario> findByAuthUserId(String authUserId);

    boolean existsByAuthUserId(String authUserId);

    boolean existsByEmailIgnoreCase(String email);

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

    @Query(
            value = """
                    SELECT COUNT(*) > 0
                    FROM auth.users
                    WHERE email = :email
                      AND id::text = :uid
                    """,
            nativeQuery = true
    )
    boolean existeEnAuthSupabase(
            @Param("email") String email,
            @Param("uid") String uid
    );
}
