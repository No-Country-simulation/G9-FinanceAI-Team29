package com.financeai.service;

import com.financeai.model.EstadoUsuario;
import com.financeai.model.Usuario;
import com.financeai.repository.UsuarioRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Autenticación propia del backend (reemplaza a Supabase Auth).
 *
 * <p>Registro: hashea la contraseña con bcrypt y guarda el usuario.
 * <p>Login: verifica la contraseña y emite un JWT firmado por el backend ({@link JwtService}).
 */
@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarioRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public Usuario registrar(String email, String password, String nombre, String apellido) {
        String emailNorm = email.trim().toLowerCase();
        if (usuarioRepository.existsByEmailIgnoreCase(emailNorm)) {
            throw new IllegalArgumentException("Ya existe una cuenta con ese email.");
        }

        Usuario usuario = new Usuario();
        usuario.setId(generarSiguienteId());
        usuario.setEmail(emailNorm);
        usuario.setNombre(nombre.trim());
        usuario.setApellido(apellido.trim());
        usuario.setPasswordHash(passwordEncoder.encode(password));
        usuario.setEstado(EstadoUsuario.ACTIVO);

        return usuarioRepository.save(usuario);
    }

    /** Verifica credenciales y devuelve el JWT propio. Mensaje genérico para no filtrar info. */
    public String login(String email, String password) {
        String emailNorm = email.trim().toLowerCase();

        Usuario usuario = usuarioRepository.findByEmailIgnoreCase(emailNorm)
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas."));

        if (usuario.getPasswordHash() == null
                || !passwordEncoder.matches(password, usuario.getPasswordHash())) {
            throw new BadCredentialsException("Credenciales inválidas.");
        }
        if (usuario.getEstado() == EstadoUsuario.ELIMINADO) {
            throw new BadCredentialsException("Esta cuenta fue dada de baja.");
        }

        return jwtService.generarToken(usuario.getId(), usuario.getEmail());
    }

    private String generarSiguienteId() {
        Integer maximo = usuarioRepository.obtenerMaximoNumeroUsuario();
        int siguiente = (maximo == null ? 0 : maximo) + 1;
        return String.format("USR%04d", siguiente);
    }
}
