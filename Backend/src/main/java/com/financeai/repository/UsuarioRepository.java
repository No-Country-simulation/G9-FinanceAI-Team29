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
    // 1. Busca el usuario por su authUserId de forma directa
    Optional<Usuario> findByAuthUserId(String authUserId);

    // 2. Valida si el email y el ID coinciden en la tabla auth.users de Supabase
    @Query(value = "SELECT COUNT(*) > 0 FROM auth.users WHERE email = :email AND id::text = :uid", nativeQuery = true)
    boolean existeEnAuthSupabase(@Param("email") String email, @Param("uid") String uid);
}
