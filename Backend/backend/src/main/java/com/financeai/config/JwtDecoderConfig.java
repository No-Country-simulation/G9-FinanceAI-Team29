package com.financeai.config;

import com.financeai.service.JwtService;
import com.nimbusds.jose.JOSEException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Verificación del JWT PROPIO del backend.
 *
 * <p>Reemplaza al JWKS de Supabase: el resource server (SecurityConfig) valida los tokens con la
 * clave pública RSA de {@link JwtService} (la misma que los firmó). Al existir este bean, Spring lo
 * usa en vez del {@code jwk-set-uri} del application.yml.
 */
@Configuration
public class JwtDecoderConfig {

    @Bean
    public JwtDecoder jwtDecoder(JwtService jwtService) throws JOSEException {
        return NimbusJwtDecoder.withPublicKey(jwtService.getRsaKey().toRSAPublicKey()).build();
    }
}
