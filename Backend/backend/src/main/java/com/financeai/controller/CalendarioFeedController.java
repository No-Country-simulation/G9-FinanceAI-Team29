package com.financeai.controller;

import com.financeai.dto.PushSubscribeRequest;
import com.financeai.dto.PushUnsubscribeRequest;
import com.financeai.model.PushSubscription;
import com.financeai.repository.PushSubscriptionRepository;
import com.financeai.repository.UsuarioRepository;
import com.financeai.service.CalendarioFeedService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Reemplaza las funciones serverless de Vercel del calendario y las notificaciones push:
 * calendario-token, calendario-ics, push-subscribe, push-unsubscribe.
 *
 * <p>El usuario sale del {@code sub} del JWT (= usuarioId); el feed .ics es público y se
 * protege con el token en la URL.
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Calendario y Push", description = "Feed .ics y suscripciones de notificaciones push")
public class CalendarioFeedController {

    private final CalendarioFeedService feedService;
    private final PushSubscriptionRepository pushRepository;
    private final UsuarioRepository usuarioRepository;

    public CalendarioFeedController(CalendarioFeedService feedService,
                                    PushSubscriptionRepository pushRepository,
                                    UsuarioRepository usuarioRepository) {
        this.feedService = feedService;
        this.pushRepository = pushRepository;
        this.usuarioRepository = usuarioRepository;
    }

    /** Token secreto del feed .ics del usuario logueado (se genera on-demand). */
    @GetMapping("/calendario-token")
    public ResponseEntity<?> calendarioToken(@AuthenticationPrincipal Jwt jwt) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("mensaje", "No autorizado."));
        }
        try {
            String token = feedService.obtenerOGenerarToken(jwt.getSubject());
            return ResponseEntity.ok(Map.of("token", token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("mensaje", e.getMessage()));
        }
    }

    /** Feed .ics PÚBLICO (los apps de calendario no mandan Authorization). Protegido por el token. */
    @GetMapping(value = "/calendario-ics", produces = "text/calendar;charset=utf-8")
    public ResponseEntity<String> calendarioIcs(@RequestParam(required = false) String token) {
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().contentType(MediaType.TEXT_PLAIN)
                    .body("Falta el token de suscripción.");
        }
        try {
            String ics = feedService.generarIcs(token);
            return ResponseEntity.ok()
                    .header("Content-Disposition", "inline; filename=\"calendario-financiero.ics\"")
                    .header("Cache-Control", "public, max-age=1800")
                    .body(ics);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).contentType(MediaType.TEXT_PLAIN)
                    .body("Token inválido.");
        }
    }

    /** Guarda (o actualiza) la suscripción push del navegador del usuario logueado. */
    @PostMapping("/push-subscribe")
    public ResponseEntity<?> pushSubscribe(@AuthenticationPrincipal Jwt jwt,
                                           @Valid @RequestBody PushSubscribeRequest request) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("mensaje", "No autorizado."));
        }
        String p256dh = request.keys() != null ? request.keys().p256dh() : null;
        String auth = request.keys() != null ? request.keys().auth() : null;
        if (p256dh == null || p256dh.isBlank() || auth == null || auth.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("mensaje", "La suscripción push es inválida."));
        }

        PushSubscription sub = pushRepository.findByEndpoint(request.endpoint())
                .orElseGet(PushSubscription::new);
        sub.setUsuario(usuarioRepository.getReferenceById(jwt.getSubject()));
        sub.setEndpoint(request.endpoint());
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        pushRepository.save(sub);

        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Borra la suscripción push (cuando el usuario desactiva los recordatorios). */
    @PostMapping("/push-unsubscribe")
    public ResponseEntity<?> pushUnsubscribe(@AuthenticationPrincipal Jwt jwt,
                                             @Valid @RequestBody PushUnsubscribeRequest request) {
        if (jwt == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("mensaje", "No autorizado."));
        }
        pushRepository.deleteByUsuarioIdAndEndpoint(jwt.getSubject(), request.endpoint());
        return ResponseEntity.ok(Map.of("ok", true));
    }
}
