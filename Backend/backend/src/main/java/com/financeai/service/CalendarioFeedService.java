package com.financeai.service;

import com.financeai.model.EventoCalendario;
import com.financeai.model.Goal;
import com.financeai.model.Usuario;
import com.financeai.repository.EventoCalendarioRepository;
import com.financeai.repository.GoalRepository;
import com.financeai.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Feed de calendario (.ics) y su token secreto (reemplaza a las funciones
 * calendario-token / calendario-ics de Vercel).
 *
 * <p>El token identifica el feed sin exponer el usuarioId; se genera on-demand la primera vez.
 * El .ics es público (los apps de calendario no mandan Authorization), protegido por ese token.
 */
@Service
public class CalendarioFeedService {

    private static final DateTimeFormatter FMT_ICS = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final UsuarioRepository usuarioRepository;
    private final GoalRepository goalRepository;
    private final EventoCalendarioRepository eventoRepository;

    public CalendarioFeedService(UsuarioRepository usuarioRepository,
                                 GoalRepository goalRepository,
                                 EventoCalendarioRepository eventoRepository) {
        this.usuarioRepository = usuarioRepository;
        this.goalRepository = goalRepository;
        this.eventoRepository = eventoRepository;
    }

    /** Devuelve el token del feed del usuario, generándolo si es la primera vez. */
    @Transactional
    public String obtenerOGenerarToken(String usuarioId) {
        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));

        if (usuario.getIcsToken() == null || usuario.getIcsToken().isBlank()) {
            usuario.setIcsToken(UUID.randomUUID().toString());
            usuarioRepository.save(usuario);
        }
        return usuario.getIcsToken();
    }

    /**
     * Genera el texto .ics para el feed identificado por {@code token}.
     * Incluye metas ACTIVAS con fecha objetivo y los eventos manuales del calendario.
     *
     * @throws IllegalArgumentException si el token no corresponde a ningún usuario.
     */
    @Transactional(readOnly = true)
    public String generarIcs(String token) {
        Usuario usuario = usuarioRepository.findByIcsToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Token inválido."));

        List<String> lineas = new ArrayList<>(List.of(
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//FinSightAI//Calendario Financiero//ES",
                "CALSCALE:GREGORIAN",
                "X-WR-CALNAME:Calendario Financiero FinSightAI",
                "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
                "X-PUBLISHED-TTL:PT6H"
        ));

        goalRepository.findByUsuarioIdAndEstadoOrderByFechaCreacionDesc(usuario.getId(), "ACTIVA")
                .stream()
                .filter(m -> m.getFechaObjetivo() != null)
                .forEach(m -> agregarEvento(lineas,
                        "meta-" + m.getId(), m.getFechaObjetivo(), "Meta: " + m.getNombre()));

        eventoRepository.findByUsuarioIdOrderByFechaInicioAsc(usuario.getId())
                .forEach(e -> agregarEvento(lineas,
                        "evento-" + e.getId(), e.getFechaInicio(), e.getTitulo()));

        lineas.add("END:VCALENDAR");
        return String.join("\r\n", lineas);
    }

    private void agregarEvento(List<String> lineas, String uid, LocalDate fecha, String resumen) {
        lineas.add("BEGIN:VEVENT");
        lineas.add("UID:" + uid + "@finsightai");
        lineas.add("DTSTART;VALUE=DATE:" + fecha.format(FMT_ICS));
        lineas.add("SUMMARY:" + escapar(resumen));
        lineas.add("END:VEVENT");
    }

    private String escapar(String valor) {
        if (valor == null) return "";
        return valor
                .replace("\\", "\\\\")
                .replace(",", "\\,")
                .replace(";", "\\;")
                .replaceAll("\\r?\\n", " ");
    }
}
