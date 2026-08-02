package com.financeai.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Autenticación service-to-service (AI-Service → backend).
 *
 * <p>Si un request trae el header {@code X-Service-Token} con el valor configurado
 * en {@code app.service-token}, se lo autentica como un principal de servicio
 * (autoridad {@code ROLE_SERVICE}). Así el AI-Service puede leer los datos que
 * necesita sin un token de usuario.
 *
 * <p>Si el token no está configurado (vacío) o no coincide, el filtro no hace nada
 * y el request continúa como anónimo (o con el JWT de usuario si viene).
 */
@Component
public class ServiceTokenAuthFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Service-Token";

    private final String serviceToken;

    public ServiceTokenAuthFilter(@Value("${app.service-token:}") String serviceToken) {
        this.serviceToken = serviceToken;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {

        String provided = request.getHeader(HEADER);

        boolean habilitado = serviceToken != null && !serviceToken.isBlank();
        boolean coincide = provided != null && provided.equals(serviceToken);
        boolean sinAutenticarAun = SecurityContextHolder.getContext().getAuthentication() == null;

        if (habilitado && coincide && sinAutenticarAun) {
            var auth = new UsernamePasswordAuthenticationToken(
                    "ai-service",
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_SERVICE")));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(request, response);
    }
}
