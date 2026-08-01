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
        String displayName = (request.getNombres() + " " + request.getApellidos()).trim();

        // 1. Crear primero en auth.users a través de Supabase Auth API
        String authUserId = supabaseAuthService.crearUsuarioEnAuthSupabase(
                request.getEmail(),
                request.getPassword(),
                request.getNombres(), request.getApellidos()
        );

        // 2. Crear la entidad local con formato USR****
        Usuario usuario = new Usuario();
        usuario.setId(generarSiguienteIdUsuario()); // Genera USR1001
        usuario.setAuthUserId(authUserId);
        usuario.setEmail(request.getEmail());
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
