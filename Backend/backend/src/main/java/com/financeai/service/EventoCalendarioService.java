package com.financeai.service;

import com.financeai.dto.EventoCalendarioCreateRequest;
import com.financeai.dto.EventoCalendarioResponse;
import com.financeai.dto.EventoCalendarioUpdateRequest;
import com.financeai.model.EventoCalendario;
import com.financeai.model.Usuario;
import com.financeai.repository.EventoCalendarioRepository;
import com.financeai.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EventoCalendarioService {
    private static final List<String> TIPOS = List.of("Pago", "Ingreso", "Meta", "Recordatorio");

    private final EventoCalendarioRepository repository;
    private final UsuarioRepository usuarioRepository;

    public EventoCalendarioService(EventoCalendarioRepository repository, UsuarioRepository usuarioRepository) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<EventoCalendarioResponse> list(String usuarioId) {
        requireUser(usuarioId);
        return repository.findByUsuarioIdOrderByFechaInicioAsc(usuarioId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public EventoCalendarioResponse create(String usuarioId, EventoCalendarioCreateRequest request) {
        Usuario usuario = requireUser(usuarioId);
        EventoCalendario evento = new EventoCalendario();
        evento.setUsuario(usuario);
        evento.setTitulo(request.titulo().trim());
        evento.setTipo(tipo(request.tipo()));
        evento.setFechaInicio(request.fechaInicio());
        evento.setFechaFin(request.fechaFin());
        return toResponse(repository.save(evento));
    }

    @Transactional
    public EventoCalendarioResponse update(String usuarioId, String eventoId, EventoCalendarioUpdateRequest request) {
        EventoCalendario evento = requireOwned(usuarioId, eventoId);
        if (request.titulo() != null) evento.setTitulo(request.titulo().trim());
        if (request.tipo() != null) evento.setTipo(tipo(request.tipo()));
        if (request.fechaInicio() != null) evento.setFechaInicio(request.fechaInicio());
        if (request.fechaFin() != null) evento.setFechaFin(request.fechaFin());
        return toResponse(repository.save(evento));
    }

    @Transactional
    public void delete(String usuarioId, String eventoId) {
        EventoCalendario evento = requireOwned(usuarioId, eventoId);
        repository.delete(evento);
    }

    private Usuario requireUser(String id) {
        return usuarioRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));
    }

    private EventoCalendario requireOwned(String usuarioId, String eventoId) {
        EventoCalendario evento = repository.findById(eventoId)
            .orElseThrow(() -> new IllegalArgumentException("Evento no encontrado."));
        if (!evento.getUsuario().getId().equals(usuarioId)) {
            throw new IllegalArgumentException("El evento no pertenece al usuario.");
        }
        return evento;
    }

    private String tipo(String value) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || !TIPOS.contains(normalized)) {
            throw new IllegalArgumentException("Tipo de evento inválido.");
        }
        return normalized;
    }

    private EventoCalendarioResponse toResponse(EventoCalendario evento) {
        return new EventoCalendarioResponse(
            evento.getId(),
            evento.getUsuario().getId(),
            evento.getTitulo(),
            evento.getTipo(),
            evento.getFechaInicio(),
            evento.getFechaFin(),
            evento.getFechaCreacion(),
            evento.getFechaActualizacion()
        );
    }
}
