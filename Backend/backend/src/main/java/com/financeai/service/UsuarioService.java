package com.financeai.service;

import com.financeai.dto.RegisterRequest;
import com.financeai.model.Usuario;
import com.financeai.repository.UsuarioRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    // Si estás usando un cliente de Supabase para registrar el auth.user desde Spring Boot:
    // @Autowired
    // private SupabaseAuthService supabaseAuthService;
    @Autowired
    private SupabaseAuthService supabaseAuthService;

    @Transactional
    public Usuario registrarNuevoUsuario(RegisterRequest request) {
        String email = request.getEmail() == null ? null : request.getEmail().trim();

        // 0. Rechazar duplicados ANTES de crear el auth.user en Supabase.
        //    Evita usuarios huérfanos y unifica el comportamiento con POST /api/usuarios.
        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("El email es obligatorio.");
        }
        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Ya existe un perfil con ese email.");
        }

        // 1. Crear en auth.users a través de Supabase Auth API.
        String authUserId = supabaseAuthService.crearUsuarioEnAuthSupabase(
                email,
                request.getPassword(),
                request.getNombres(),
                request.getApellidos()
        );

        // 1b. Seguridad extra: que ese authUserId no tenga ya un perfil local.
        if (usuarioRepository.existsByAuthUserId(authUserId)) {
            throw new IllegalStateException("Ese usuario de Supabase ya tiene un perfil.");
        }

        // 2. Crear la entidad local con formato USR####.
        Usuario usuario = new Usuario();
        usuario.setId(generarSiguienteIdUsuario());
        usuario.setAuthUserId(authUserId);
        usuario.setEmail(email);
        usuario.setNombre(request.getNombres());
        usuario.setApellido(request.getApellidos());
        usuario.setPerfilFinanciero("En evaluacion");
        usuario.setActivo(true);

        return usuarioRepository.save(usuario);
    }


    /**
     * Genera un ID con formato USR00001, USR00002, etc.
     */
    private String generarSiguienteIdUsuario() {
        Integer maximoActual = usuarioRepository.obtenerMaximoNumeroUsuario();
        int siguienteNumero = (maximoActual == null ? 1000 : maximoActual) +1;
        return String.format("USR%04d", siguienteNumero);
    }
}
