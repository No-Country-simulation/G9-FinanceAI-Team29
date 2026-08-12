package com.financeai.service;

import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests del JwtService (emisión + verificación del token propio del backend).
 * No cargan el contexto de Spring: instancian el servicio directo.
 */
class JwtServiceTest {

    private final JwtService jwt = new JwtService(3600);

    @Test
    void firma_y_verifica_devuelve_los_claims() throws Exception {
        String token = jwt.generarToken("USR0001", "demo@finsight.com");

        JWTClaimsSet claims = jwt.verificarToken(token);

        assertThat(claims.getSubject()).isEqualTo("USR0001");
        assertThat(claims.getStringClaim("email")).isEqualTo("demo@finsight.com");
        assertThat(claims.getExpirationTime()).isNotNull();
    }

    @Test
    void token_manipulado_es_rechazado() {
        String token = jwt.generarToken("USR0001", "demo@finsight.com");
        // Alteramos el final (la firma) → debe fallar la verificación.
        String manipulado = token.substring(0, token.length() - 4) + "AAAA";

        assertThatThrownBy(() -> jwt.verificarToken(manipulado))
                .isInstanceOf(Exception.class);
    }

    @Test
    void token_de_otra_instancia_no_valida_aca() throws Exception {
        // Otra instancia = otra clave RSA → su token no debe verificar con esta.
        JwtService otro = new JwtService(3600);
        String tokenAjeno = otro.generarToken("USR0002", "otro@finsight.com");

        assertThatThrownBy(() -> jwt.verificarToken(tokenAjeno))
                .isInstanceOf(SecurityException.class);
    }
}
