package com.financeai.service;

import com.financeai.exception.EmailNoConfirmadoException;
import com.financeai.model.EmailConfirmationToken;
import com.financeai.model.EstadoUsuario;
import com.financeai.model.PasswordResetToken;
import com.financeai.model.Usuario;
import com.financeai.repository.EmailConfirmationTokenRepository;
import com.financeai.repository.PasswordResetTokenRepository;
import com.financeai.repository.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Autenticación propia del backend (reemplaza a Supabase Auth).
 *
 * <p>Registro: hashea la contraseña con bcrypt y guarda el usuario.
 * <p>Login: verifica la contraseña y emite un JWT firmado por el backend ({@link JwtService}).
 * <p>Reset: genera un token de un solo uso, lo manda por email ({@link EmailService}) y permite
 * fijar una nueva contraseña.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long RESET_TTL_HORAS = 1;
    private static final long CONFIRM_TTL_HORAS = 24;

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final EmailConfirmationTokenRepository confirmTokenRepository;
    private final EmailService emailService;
    private final String siteUrl;

    public AuthService(UsuarioRepository usuarioRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       PasswordResetTokenRepository resetTokenRepository,
                       EmailConfirmationTokenRepository confirmTokenRepository,
                       EmailService emailService,
                       @Value("${app.site-url:http://localhost}") String siteUrl) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.resetTokenRepository = resetTokenRepository;
        this.confirmTokenRepository = confirmTokenRepository;
        this.emailService = emailService;
        this.siteUrl = siteUrl.replaceAll("/+$", "");
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
        usuario.setEmailConfirmado(false);

        Usuario guardado = usuarioRepository.save(usuario);
        enviarEmailConfirmacion(guardado);
        return guardado;
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
        if (!usuario.estaEmailConfirmado()) {
            throw new EmailNoConfirmadoException(
                    "Confirmá tu correo para poder ingresar. Revisá tu casilla (y el spam).");
        }

        return jwtService.generarToken(usuario.getId(), usuario.getEmail());
    }

    /** Cambia la contraseña verificando primero la actual. */
    @Transactional
    public void cambiarPassword(String usuarioId, String passwordActual, String passwordNueva) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new BadCredentialsException("Credenciales inválidas."));

        if (usuario.getPasswordHash() == null
                || !passwordEncoder.matches(passwordActual, usuario.getPasswordHash())) {
            throw new BadCredentialsException("La contraseña actual no es correcta.");
        }

        usuario.setPasswordHash(passwordEncoder.encode(passwordNueva));
        usuarioRepository.save(usuario);
    }

    /**
     * Genera un token de reset y lo envía por email. Silencioso si el email no existe o la cuenta
     * está eliminada (para no filtrar qué correos están registrados). El controller siempre
     * responde con un mensaje genérico.
     */
    @Transactional
    public void solicitarReset(String email) {
        String emailNorm = email.trim().toLowerCase();
        var maybe = usuarioRepository.findByEmailIgnoreCase(emailNorm);
        if (maybe.isEmpty()) {
            log.info("[reset] Pedido de reset para email no registrado (se ignora): {}", emailNorm);
            return;
        }

        Usuario usuario = maybe.get();
        if (usuario.getEstado() == EstadoUsuario.ELIMINADO) {
            return;
        }

        String tokenPlano = generarTokenSeguro();

        PasswordResetToken token = new PasswordResetToken();
        token.setUsuario(usuario);
        token.setTokenHash(sha256(tokenPlano));
        token.setExpiraAt(LocalDateTime.now().plusHours(RESET_TTL_HORAS));
        resetTokenRepository.save(token);

        String resetUrl = siteUrl + "/reset-password?token=" + tokenPlano;
        log.info("[reset] Enlace de restablecimiento para {}: {}", usuario.getEmail(), resetUrl);
        emailService.enviarResetPassword(usuario.getEmail(), usuario.getNombre(), resetUrl);
    }

    /** Valida el token (existe, no usado, no vencido) y fija la nueva contraseña. */
    @Transactional
    public void resetearPassword(String tokenPlano, String passwordNueva) {
        PasswordResetToken token = resetTokenRepository.findByTokenHash(sha256(tokenPlano))
                .orElseThrow(() -> new IllegalArgumentException("El enlace no es válido."));

        if (token.isUsado()) {
            throw new IllegalArgumentException("Este enlace ya fue utilizado.");
        }
        if (token.getExpiraAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("El enlace expiró. Pedí uno nuevo.");
        }

        Usuario usuario = token.getUsuario();
        usuario.setPasswordHash(passwordEncoder.encode(passwordNueva));
        usuario.setEstado(EstadoUsuario.ACTIVO);
        usuarioRepository.save(usuario);

        token.setUsado(true);
        resetTokenRepository.save(token);
    }

    /** Genera el token de confirmación y manda el email. Lo usan el registro y el reenvío. */
    private void enviarEmailConfirmacion(Usuario usuario) {
        String tokenPlano = generarTokenSeguro();

        EmailConfirmationToken token = new EmailConfirmationToken();
        token.setUsuario(usuario);
        token.setTokenHash(sha256(tokenPlano));
        token.setExpiraAt(LocalDateTime.now().plusHours(CONFIRM_TTL_HORAS));
        confirmTokenRepository.save(token);

        String confirmUrl = siteUrl + "/confirmar?token=" + tokenPlano;
        log.info("[confirm] Enlace de confirmación para {}: {}", usuario.getEmail(), confirmUrl);
        emailService.enviarConfirmacion(usuario.getEmail(), usuario.getNombre(), confirmUrl);
    }

    /** Valida el token de confirmación (existe, no usado, no vencido) y confirma el email. */
    @Transactional
    public void confirmarEmail(String tokenPlano) {
        EmailConfirmationToken token = confirmTokenRepository.findByTokenHash(sha256(tokenPlano))
                .orElseThrow(() -> new IllegalArgumentException("El enlace de confirmación no es válido."));

        if (token.isUsado()) {
            throw new IllegalArgumentException("Este enlace ya fue utilizado. Probá iniciar sesión.");
        }
        if (token.getExpiraAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("El enlace de confirmación expiró. Pedí uno nuevo.");
        }

        Usuario usuario = token.getUsuario();
        usuario.setEmailConfirmado(true);
        usuarioRepository.save(usuario);

        token.setUsado(true);
        confirmTokenRepository.save(token);
    }

    /** Reenvía la confirmación. Silencioso si el email no existe, está eliminado o ya confirmado. */
    @Transactional
    public void reenviarConfirmacion(String email) {
        String emailNorm = email.trim().toLowerCase();
        var maybe = usuarioRepository.findByEmailIgnoreCase(emailNorm);
        if (maybe.isEmpty()) {
            return;
        }
        Usuario usuario = maybe.get();
        if (usuario.getEstado() == EstadoUsuario.ELIMINADO || usuario.estaEmailConfirmado()) {
            return;
        }
        enviarEmailConfirmacion(usuario);
    }

    /** Token aleatorio de 256 bits en base64url (el que viaja en el email). */
    private static String generarTokenSeguro() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Hash SHA-256 (hex) del token; es lo único que se guarda en la BD. */
    private static String sha256(String valor) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(valor.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private String generarSiguienteId() {
        Integer maximo = usuarioRepository.obtenerMaximoNumeroUsuario();
        int siguiente = (maximo == null ? 0 : maximo) + 1;
        return String.format("USR%04d", siguiente);
    }
}
