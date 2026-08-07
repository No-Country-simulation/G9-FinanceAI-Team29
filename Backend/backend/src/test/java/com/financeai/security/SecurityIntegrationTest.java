package com.financeai.security;

import com.financeai.config.OwnershipInterceptor;
import com.financeai.config.SecurityConfig;
import com.financeai.config.ServiceTokenAuthFilter;
import com.financeai.config.WebMvcConfig;
import com.financeai.controller.TransaccionController;
import com.financeai.model.Usuario;
import com.financeai.repository.TransaccionRepository;
import com.financeai.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests de integración de la seguridad (B3): autenticación + ownership.
 *
 * Usa @WebMvcTest (capa web + seguridad) SIN BD ni JWKS real:
 *   - el JwtDecoder se mockea (los tokens se inyectan con .with(jwt()))
 *   - los repositorios se mockean
 *
 * Verifica el endpoint /api/usuarios/{id}/transacciones, protegido por
 * SecurityConfig + OwnershipInterceptor + ServiceTokenAuthFilter.
 */
@WebMvcTest(TransaccionController.class)
@Import({SecurityConfig.class, ServiceTokenAuthFilter.class, OwnershipInterceptor.class, WebMvcConfig.class})
@TestPropertySource(properties = {
    "app.service-token=test-service-token",
    "app.admin-emails=demo.admin@finsight.com",
    "app.cors.allowed-origins=http://localhost:5173"
})
class SecurityIntegrationTest {

    private static final String URL = "/api/usuarios/USR0001/transacciones";

    @Autowired
    private MockMvc mockMvc;

    // Requerido por oauth2ResourceServer().jwt(); no se invoca (usamos .with(jwt())).
    @MockBean
    private JwtDecoder jwtDecoder;

    @MockBean
    private TransaccionRepository transaccionRepository;

    @MockBean
    private UsuarioRepository usuarioRepository;

    private Usuario usuarioConId(String id) {
        Usuario u = mock(Usuario.class);
        given(u.getId()).willReturn(id);
        return u;
    }

    @Test
    void sinToken_devuelve401() throws Exception {
        mockMvc.perform(get(URL))
               .andExpect(status().isUnauthorized());
    }

    @Test
    void usuarioDueno_devuelve200() throws Exception {
        // El JWT (sub) mapea al mismo USR0001 del path → es el dueño.
        Usuario dueno = usuarioConId("USR0001");
        given(usuarioRepository.findByAuthUserId("sub-dueno")).willReturn(Optional.of(dueno));
        given(transaccionRepository.findByUsuarioId("USR0001")).willReturn(List.of());

        mockMvc.perform(get(URL)
                .with(jwt().jwt(j -> j.subject("sub-dueno").claim("email", "dueno@x.com"))))
               .andExpect(status().isOk());
    }

    @Test
    void usuarioNoDueno_devuelve403() throws Exception {
        // El JWT mapea a USR0002, pero pide datos de USR0001 → prohibido.
        Usuario otro = usuarioConId("USR0002");
        given(usuarioRepository.findByAuthUserId("sub-otro")).willReturn(Optional.of(otro));

        mockMvc.perform(get(URL)
                .with(jwt().jwt(j -> j.subject("sub-otro").claim("email", "otro@x.com"))))
               .andExpect(status().isForbidden());
    }

    @Test
    void serviceToken_accedeATodo_200() throws Exception {
        // El AI-Service (X-Service-Token) accede sin token de usuario.
        given(transaccionRepository.findByUsuarioId("USR0001")).willReturn(List.of());

        mockMvc.perform(get(URL).header("X-Service-Token", "test-service-token"))
               .andExpect(status().isOk());
    }

    @Test
    void admin_accedeATodo_200() throws Exception {
        // Email del token dentro de app.admin-emails → acceso total.
        given(transaccionRepository.findByUsuarioId("USR0001")).willReturn(List.of());

        mockMvc.perform(get(URL)
                .with(jwt().jwt(j -> j.subject("sub-admin").claim("email", "demo.admin@finsight.com"))))
               .andExpect(status().isOk());
    }
}
