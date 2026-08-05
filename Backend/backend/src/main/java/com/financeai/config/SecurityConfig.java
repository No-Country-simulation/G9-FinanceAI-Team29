package com.financeai.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Configuración de seguridad — B3 (autenticación real con el JWT de Supabase).
 *
 * <p><b>FASE 1 (esta):</b> deja la infraestructura de validación del token en su
 * lugar SIN romper nada. Todo request está permitido (`permitAll`); si viene un
 * token en el header Authorization, el resource server lo valida contra el JWKS
 * de Supabase (firma ES256) y lo deja disponible. Si no viene, sigue como anónimo.
 * Esto permite que el frontend y el AI-Service, que todavía no mandan token, sigan
 * funcionando mientras se completa el resto de las fases.
 *
 * <p><b>FASE 4:</b> se reemplaza `permitAll()` por reglas estrictas (requiere token
 * + chequeo de propiedad), dejando públicos solo `/api/auth/**` y el registro.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ServiceTokenAuthFilter serviceTokenAuthFilter
    ) throws Exception {
        http
            // API stateless: sin CSRF ni sesión de servidor.
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // FASE 4: estricto. Público solo lo mínimo; el resto requiere auth
            // (JWT de usuario o X-Service-Token). El chequeo de DUEÑO lo hace
            // OwnershipInterceptor sobre /api/usuarios/{usuarioId}/**.
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()                       // login + registro
                .requestMatchers(HttpMethod.POST, "/api/usuarios").permitAll()     // crear perfil (registro)
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html",
                                 "/v3/api-docs/**", "/error").permitAll()
                .requestMatchers("/actuator/health").permitAll()                   // health-check público
                .anyRequest().authenticated())
            // Valida el JWT de Supabase usando el jwk-set-uri del application.yml.
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
            // Auth service-to-service (AI-Service) vía header X-Service-Token.
            .addFilterBefore(serviceTokenAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS a nivel del filtro de seguridad (necesario porque Spring Security corre
     * antes que el CORS de Spring MVC). Fuente única de la config de CORS del backend.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
            String allowedOrigins
    ) {
        List<String> origenes = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(origenes);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
