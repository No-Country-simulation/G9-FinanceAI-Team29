package com.financeai.controller;

import com.financeai.service.RecordatoriosService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Recordatorios financieros: job diario automático + disparador manual.
 * Reemplaza al cron enviar-recordatorios de Vercel.
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Recordatorios", description = "Job diario de recordatorios de metas/eventos próximos")
public class RecordatoriosController {

    private static final Logger log = LoggerFactory.getLogger(RecordatoriosController.class);

    private final RecordatoriosService recordatoriosService;
    private final List<String> adminEmails;

    public RecordatoriosController(
            RecordatoriosService recordatoriosService,
            @Value("${app.admin-emails:demo.admin@finsight.com}") String adminEmails) {
        this.recordatoriosService = recordatoriosService;
        this.adminEmails = Arrays.stream(adminEmails.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    /** Job automático: corre todos los días (cron configurable). */
    @Scheduled(cron = "${app.recordatorios.cron:0 0 9 * * *}", zone = "${app.recordatorios.zone:America/Argentina/Buenos_Aires}")
    public void jobDiario() {
        log.info("[recordatorios] Ejecutando job diario…");
        recordatoriosService.enviarRecordatorios();
    }

    /**
     * Disparador manual (para probar o para un cron externo). Requiere ser admin
     * (email en app.admin-emails) o traer el X-Service-Token (ROLE_SERVICE).
     */
    @PostMapping("/enviar-recordatorios")
    public ResponseEntity<?> enviarAhora() {
        if (!autorizado()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("mensaje", "Solo un admin o el service-token pueden disparar esto."));
        }
        RecordatoriosService.Resultado r = recordatoriosService.enviarRecordatorios();
        return ResponseEntity.ok(Map.of(
                "usuarios", r.usuarios(),
                "correosEnviados", r.correos(),
                "pushEnviados", r.push()));
    }

    private boolean autorizado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        boolean esServicio = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SERVICE".equals(a.getAuthority()));
        if (esServicio) {
            return true;
        }
        if (auth.getPrincipal() instanceof Jwt jwt) {
            String email = jwt.getClaimAsString("email");
            return email != null && adminEmails.contains(email);
        }
        return false;
    }
}
