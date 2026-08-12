package com.financeai.service;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Date;

/**
 * Emisión y verificación del JWT PROPIO del backend (reemplaza la firma de Supabase).
 *
 * <p>El backend firma con su clave privada RSA (RS256) y verifica con la pública. Este servicio
 * es autónomo (usa Nimbus directo) para poder construirse y testearse sin tocar el flujo de auth
 * actual de Supabase.
 *
 * <p><b>Nota de producción:</b> por ahora genera un par RSA al arrancar → los tokens se invalidan
 * si el backend se reinicia. En producción hay que cargar una clave FIJA (montada como secreto)
 * para que los tokens sobrevivan reinicios y para poder escalar a varias instancias.
 */
@Service
public class JwtService {

    private static final String KEY_ID = "finsight-key";

    private final RSAKey rsaKey;
    private final long expiracionSegundos;

    public JwtService(@Value("${app.jwt.expiration-seconds:3600}") long expiracionSegundos) {
        this.expiracionSegundos = expiracionSegundos;
        try {
            this.rsaKey = new RSAKeyGenerator(2048).keyID(KEY_ID).generate();
        } catch (JOSEException e) {
            throw new IllegalStateException("No se pudo generar la clave RSA para el JWT", e);
        }
    }

    /** Firma un JWT para el usuario (claims: sub = usuarioId, email, iat, exp). */
    public String generarToken(String usuarioId, String email) {
        Instant ahora = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(usuarioId)
                .claim("email", email)
                .issueTime(Date.from(ahora))
                .expirationTime(Date.from(ahora.plusSeconds(expiracionSegundos)))
                .build();

        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(rsaKey.getKeyID()).build(),
                claims);
        try {
            jwt.sign(new RSASSASigner(rsaKey));
        } catch (JOSEException e) {
            throw new IllegalStateException("No se pudo firmar el token", e);
        }
        return jwt.serialize();
    }

    /** Verifica firma + expiración y devuelve los claims. Lanza excepción si el token es inválido. */
    public JWTClaimsSet verificarToken(String token) throws Exception {
        SignedJWT jwt = SignedJWT.parse(token);
        if (!jwt.verify(new RSASSAVerifier(rsaKey.toPublicJWK()))) {
            throw new SecurityException("Firma del token inválida");
        }
        JWTClaimsSet claims = jwt.getJWTClaimsSet();
        if (claims.getExpirationTime() == null || claims.getExpirationTime().before(new Date())) {
            throw new SecurityException("Token expirado");
        }
        return claims;
    }

    /** La clave RSA (para exponer la pública al JwtDecoder de Spring en el paso 2.3). */
    public RSAKey getRsaKey() {
        return rsaKey;
    }
}
