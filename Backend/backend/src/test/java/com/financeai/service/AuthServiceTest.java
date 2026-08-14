package com.financeai.service;

import com.financeai.model.EstadoUsuario;
import com.financeai.model.PasswordResetToken;
import com.financeai.model.Usuario;
import com.financeai.repository.PasswordResetTokenRepository;
import com.financeai.repository.UsuarioRepository;
import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Tests del AuthService (registro + login + reset). Repos mockeados; encoder y JwtService reales.
 * No cargan el contexto de Spring ni la BD.
 */
class AuthServiceTest {

    private final UsuarioRepository repo = mock(UsuarioRepository.class);
    private final PasswordResetTokenRepository resetRepo = mock(PasswordResetTokenRepository.class);
    private final EmailService email = mock(EmailService.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JwtService jwt = new JwtService(3600);
    private final AuthService auth =
            new AuthService(repo, encoder, jwt, resetRepo, email, "http://localhost");

    @Test
    void registrar_hashea_la_password_y_arma_el_id() {
        given(repo.existsByEmailIgnoreCase("ana@x.com")).willReturn(false);
        given(repo.obtenerMaximoNumeroUsuario()).willReturn(5);
        given(repo.save(any(Usuario.class))).willAnswer(inv -> inv.getArgument(0));

        Usuario u = auth.registrar("Ana@X.com", "secret123", "Ana", "Pérez");

        assertThat(u.getId()).isEqualTo("USR0006");
        assertThat(u.getEmail()).isEqualTo("ana@x.com");           // normalizado
        assertThat(u.getPasswordHash()).isNotEqualTo("secret123"); // hasheada, no texto plano
        assertThat(encoder.matches("secret123", u.getPasswordHash())).isTrue();
    }

    @Test
    void registrar_email_duplicado_falla() {
        given(repo.existsByEmailIgnoreCase("ana@x.com")).willReturn(true);

        assertThatThrownBy(() -> auth.registrar("ana@x.com", "secret123", "Ana", "Pérez"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void login_ok_devuelve_un_token_verificable() throws Exception {
        Usuario u = new Usuario();
        u.setId("USR0001");
        u.setEmail("ana@x.com");
        u.setPasswordHash(encoder.encode("secret123"));
        u.setEstado(EstadoUsuario.ACTIVO);
        given(repo.findByEmailIgnoreCase("ana@x.com")).willReturn(Optional.of(u));

        String token = auth.login("ana@x.com", "secret123");

        JWTClaimsSet claims = jwt.verificarToken(token);
        assertThat(claims.getSubject()).isEqualTo("USR0001");
        assertThat(claims.getStringClaim("email")).isEqualTo("ana@x.com");
    }

    @Test
    void login_password_incorrecta_falla() {
        Usuario u = new Usuario();
        u.setPasswordHash(encoder.encode("secret123"));
        u.setEstado(EstadoUsuario.ACTIVO);
        given(repo.findByEmailIgnoreCase("ana@x.com")).willReturn(Optional.of(u));

        assertThatThrownBy(() -> auth.login("ana@x.com", "otra-clave"))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void login_email_inexistente_falla() {
        given(repo.findByEmailIgnoreCase("nadie@x.com")).willReturn(Optional.empty());

        assertThatThrownBy(() -> auth.login("nadie@x.com", "secret123"))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void solicitarReset_email_inexistente_no_manda_nada() {
        given(repo.findByEmailIgnoreCase("nadie@x.com")).willReturn(Optional.empty());

        auth.solicitarReset("nadie@x.com");

        verifyNoInteractions(email, resetRepo); // silencioso: no filtra si el email existe
    }

    @Test
    void solicitarReset_ok_guarda_token_y_manda_email_con_enlace() {
        Usuario u = new Usuario();
        u.setId("USR0001");
        u.setEmail("ana@x.com");
        u.setNombre("Ana");
        u.setEstado(EstadoUsuario.ACTIVO);
        given(repo.findByEmailIgnoreCase("ana@x.com")).willReturn(Optional.of(u));

        auth.solicitarReset("ana@x.com");

        verify(resetRepo).save(any(PasswordResetToken.class));
        ArgumentCaptor<String> url = ArgumentCaptor.forClass(String.class);
        verify(email).enviarResetPassword(org.mockito.ArgumentMatchers.eq("ana@x.com"),
                org.mockito.ArgumentMatchers.eq("Ana"), url.capture());
        assertThat(url.getValue()).startsWith("http://localhost/reset-password?token=");
    }

    @Test
    void resetearPassword_token_valido_cambia_la_password_y_marca_usado() {
        Usuario u = new Usuario();
        u.setPasswordHash(encoder.encode("vieja123"));
        u.setEstado(EstadoUsuario.ACTIVO);

        PasswordResetToken token = new PasswordResetToken();
        token.setUsuario(u);
        token.setExpiraAt(LocalDateTime.now().plusMinutes(30));
        given(resetRepo.findByTokenHash(org.mockito.ArgumentMatchers.anyString()))
                .willReturn(Optional.of(token));

        auth.resetearPassword("token-plano", "NuevaClave1!");

        assertThat(encoder.matches("NuevaClave1!", u.getPasswordHash())).isTrue();
        assertThat(token.isUsado()).isTrue();
    }

    @Test
    void resetearPassword_token_vencido_falla() {
        PasswordResetToken token = new PasswordResetToken();
        token.setUsuario(new Usuario());
        token.setExpiraAt(LocalDateTime.now().minusMinutes(1));
        given(resetRepo.findByTokenHash(org.mockito.ArgumentMatchers.anyString()))
                .willReturn(Optional.of(token));

        assertThatThrownBy(() -> auth.resetearPassword("token-plano", "NuevaClave1!"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void resetearPassword_token_inexistente_falla() {
        given(resetRepo.findByTokenHash(org.mockito.ArgumentMatchers.anyString()))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> auth.resetearPassword("no-existe", "NuevaClave1!"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
