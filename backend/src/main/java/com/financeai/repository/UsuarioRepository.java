package com.financeai.repository;

import com.financeai.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, String> {
    List<Usuario> findByPerfilFinanciero(String perfilFinanciero);
    List<Usuario> findByActivo(Boolean activo);
}
