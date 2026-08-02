package com.financeai.config;

import com.financeai.repository.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Arrays;
import java.util.List;

/**
 * Chequeo de propiedad (B3 - Fase 4).
 *
 * <p>En los endpoints {@code /api/usuarios/{usuarioId}/**} un usuario solo puede
 * acceder a SU propio perfil: el {@code usuarioId} del path debe coincidir con el
 * usuario derivado de su JWT (claim {@code sub} = authUserId).
 *
 * <p>Excepciones (acceso total): el AI-Service (autoridad {@code ROLE_SERVICE}) y
 * los administradores (email del token dentro de {@code app.admin-emails}).
 */
@Component
public class OwnershipInterceptor implements HandlerInterceptor {

    private static final String PREFIJO = "/api/usuarios/";

    private final UsuarioRepository usuarioRepository;
    private final List<String> adminEmails;

    public OwnershipInterceptor(
            UsuarioRepository usuarioRepository,
            @Value("${app.admin-emails:demo.admin@finsight.com}") String adminEmails
    ) {
        this.usuarioRepository = usuarioRepository;
        this.adminEmails = Arrays.stream(adminEmails.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {

        // El preflight de CORS no lleva credenciales; se deja pasar.
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String usuarioIdPath = extraerUsuarioId(request.getRequestURI());
        if (usuarioIdPath == null) {
            return true; // no es un endpoint con {usuarioId} (ej. /me, POST /usuarios)
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            response.sendError(HttpStatus.UNAUTHORIZED.value());
            return false;
        }

        // AI-Service (service token) → acceso total.
        boolean esServicio = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SERVICE".equals(a.getAuthority()));
        if (esServicio) {
            return true;
        }

        if (auth.getPrincipal() instanceof Jwt jwt) {
            String email = jwt.getClaimAsString("email");
            if (email != null && adminEmails.contains(email)) {
                return true; // admin → acceso total
            }

            String miUsuarioId = usuarioRepository.findByAuthUserId(jwt.getSubject())
                    .map(u -> u.getId())
                    .orElse(null);

            if (usuarioIdPath.equals(miUsuarioId)) {
                return true;
            }
        }

        response.sendError(HttpStatus.FORBIDDEN.value(), "No podés acceder a datos de otro usuario.");
        return false;
    }

    /** Devuelve el {usuarioId} de /api/usuarios/{usuarioId}/... o null si no aplica (/me, registro). */
    private String extraerUsuarioId(String uri) {
        if (uri == null || !uri.startsWith(PREFIJO)) {
            return null;
        }
        String resto = uri.substring(PREFIJO.length());
        if (resto.isEmpty()) {
            return null;
        }
        String primero = resto.split("/")[0];
        if (primero.isEmpty() || primero.equalsIgnoreCase("me")) {
            return null;
        }
        return primero;
    }
}
