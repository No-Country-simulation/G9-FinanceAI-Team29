package com.financeai.security;

import com.financeai.config.OwnershipInterceptor;
import com.financeai.config.SecurityConfig;
import com.financeai.config.ServiceTokenAuthFilter;
import com.financeai.config.WebMvcConfig;
import com.financeai.controller.TransaccionController;
import com.financeai.repository.TransaccionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests de integración de la seguridad (auth propio): autenticación + ownership.
 *
 * Con el token propio, el claim `sub` ES el usuarioId (USR####), así que el ownership
 * compara el sub del token con el {usuarioId} del path directamente.
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

    // Requerido por oauth2ResourceServer().jwt(); no se invoca (los tokens se inyectan con .with(jwt())).
    @MockBean
    private JwtDecoder jwtDecoder;

    @MockBean
    private TransaccionRepository transaccionRepository;

    @Test
    void sinToken_devuelve401() throws Exception {
        mockMvc.perform(get(URL))
               .andExpect(status().isUnauthorized());
    }

    @Test
    void usuarioDueno_devuelve200() throws Exception {
        // El sub del token ES el usuarioId → USR0001 accede a sus propios datos.
        given(transaccionRepository.findByUsuarioId("USR0001")).willReturn(List.of());

        mockMvc.perform(get(URL)
                .with(jwt().jwt(j -> j.subject("USR0001").claim("email", "dueno@x.com"))))
               .andExpect(status().isOk());
    }

    @Test
    void usuarioNoDueno_devuelve403() throws Exception {
        // El token es de USR0002 pero pide los datos de USR0001 → prohibido.
        mockMvc.perform(get(URL)
                .with(jwt().jwt(j -> j.subject("USR0002").claim("email", "otro@x.com"))))
               .andExpect(status().isForbidden());
    }

    @Test
    void serviceToken_accedeATodo_200() throws Exception {
        given(transaccionRepository.findByUsuarioId("USR0001")).willReturn(List.of());

        mockMvc.perform(get(URL).header("X-Service-Token", "test-service-token"))
               .andExpect(status().isOk());
    }

    @Test
    void admin_accedeATodo_200() throws Exception {
        given(transaccionRepository.findByUsuarioId("USR0001")).willReturn(List.of());

        // Email dentro de app.admin-emails → acceso total sin importar el sub.
        mockMvc.perform(get(URL)
                .with(jwt().jwt(j -> j.subject("USR9999").claim("email", "demo.admin@finsight.com"))))
               .andExpect(status().isOk());
    }
}
