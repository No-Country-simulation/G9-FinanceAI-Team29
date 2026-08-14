package com.financeai.service;

import com.financeai.model.PushSubscription;
import com.financeai.model.Usuario;
import com.financeai.repository.EventoCalendarioRepository;
import com.financeai.repository.GoalRepository;
import com.financeai.repository.PushSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Recordatorios de eventos/metas próximos (reemplaza al cron enviar-recordatorios de Vercel).
 *
 * <p>Busca metas ACTIVAS y eventos que vencen en {@code DIAS_ANTICIPACION} días, los agrupa por
 * usuario y le manda un email (Resend) y un push (si está suscripto y hay VAPID). Lo dispara un
 * job {@code @Scheduled} diario; también hay un endpoint protegido para correrlo a mano.
 */
@Service
public class RecordatoriosService {

    private static final Logger log = LoggerFactory.getLogger(RecordatoriosService.class);
    private static final int DIAS_ANTICIPACION = 3;
    private static final DateTimeFormatter FMT_HUMANA =
            DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", new Locale("es", "AR"));

    private final GoalRepository goalRepository;
    private final EventoCalendarioRepository eventoRepository;
    private final PushSubscriptionRepository pushRepository;
    private final EmailService emailService;
    private final PushService pushService;

    public RecordatoriosService(GoalRepository goalRepository,
                                EventoCalendarioRepository eventoRepository,
                                PushSubscriptionRepository pushRepository,
                                EmailService emailService,
                                PushService pushService) {
        this.goalRepository = goalRepository;
        this.eventoRepository = eventoRepository;
        this.pushRepository = pushRepository;
        this.emailService = emailService;
        this.pushService = pushService;
    }

    private static final class Resumen {
        String email;
        String nombre;
        final List<String> items = new ArrayList<>();
    }

    public record Resultado(int usuarios, int correos, int push) {}

    /** Corre el barrido de recordatorios. Devuelve cuántos se enviaron. */
    @Transactional
    public Resultado enviarRecordatorios() {
        LocalDate objetivo = LocalDate.now().plusDays(DIAS_ANTICIPACION);
        Map<String, Resumen> porUsuario = new LinkedHashMap<>();

        goalRepository.findByEstadoAndFechaObjetivo("ACTIVA", objetivo).forEach(m ->
                agregar(porUsuario, m.getUsuario(), "Meta: " + m.getNombre(), m.getFechaObjetivo()));

        eventoRepository.findByFechaInicio(objetivo).forEach(e ->
                agregar(porUsuario, e.getUsuario(), e.getTitulo(), e.getFechaInicio()));

        int correos = 0;
        int push = 0;

        for (Resumen r : porUsuario.values()) {
            if (r.email != null && !r.email.isBlank()) {
                try {
                    emailService.enviarRecordatorio(r.email, r.nombre, r.items, DIAS_ANTICIPACION);
                    correos++;
                } catch (Exception e) {
                    log.warn("[recordatorios] No se pudo enviar el email a {}: {}", r.email, e.getMessage());
                }
            }
        }

        // Push: por usuario suscripto. Recorremos las suscripciones de cada usuario con items.
        if (pushService.estaHabilitado()) {
            for (Map.Entry<String, Resumen> entry : porUsuario.entrySet()) {
                String usuarioId = entry.getKey();
                Resumen r = entry.getValue();
                String payload = payloadPush(r.items.size());
                for (PushSubscription sub : pushRepository.findByUsuarioId(usuarioId)) {
                    int status = pushService.enviar(sub.getEndpoint(), sub.getP256dh(), sub.getAuth(), payload);
                    if (status == 404 || status == 410) {
                        // La suscripción ya no existe (navegador desinstalado / permiso revocado).
                        pushRepository.deleteByEndpoint(sub.getEndpoint());
                    } else if (status >= 200 && status < 300) {
                        push++;
                    }
                }
            }
        }

        log.info("[recordatorios] {} usuario(s), {} correo(s), {} push (objetivo {}).",
                porUsuario.size(), correos, push, objetivo);
        return new Resultado(porUsuario.size(), correos, push);
    }

    private void agregar(Map<String, Resumen> mapa, Usuario usuario, String titulo, LocalDate fecha) {
        if (usuario == null) return;
        Resumen r = mapa.computeIfAbsent(usuario.getId(), k -> {
            Resumen nuevo = new Resumen();
            nuevo.email = usuario.getEmail();
            nuevo.nombre = usuario.getNombre();
            return nuevo;
        });
        r.items.add(titulo + " — " + fecha.format(FMT_HUMANA));
    }

    private String payloadPush(int cantidad) {
        return "{\"title\":\"Recordatorio financiero\",\"body\":\"Tenés "
                + cantidad + " evento(s) en " + DIAS_ANTICIPACION
                + " días.\",\"url\":\"/calendario-financiero\"}";
    }
}
