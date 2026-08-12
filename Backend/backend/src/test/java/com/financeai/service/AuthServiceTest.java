package com.financeai.service;

import com.financeai.model.EstadoUsuario;
import com.financeai.model.Usuario;
import com.financeai.repository.UsuarioRepository;
import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

/**
 * Tests del AuthService (registro + login). Repo mockeado; encoder y JwtService reales.
 * No cargan el contexto de Spring ni la BD.
 */
class AuthServiceTest {

    private final UsuarioRepository repo = mock(UsuarioRepository.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder();
    private final JwtService jwt = new JwtService(3600);
    private final AuthService auth = new AuthService(repo, encoder, jwt);

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
}
