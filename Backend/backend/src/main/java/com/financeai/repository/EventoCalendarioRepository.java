package com.financeai.repository;

import com.financeai.model.EventoCalendario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface EventoCalendarioRepository extends JpaRepository<EventoCalendario, String> {
    List<EventoCalendario> findByUsuarioIdOrderByFechaInicioAsc(String usuarioId);
    List<EventoCalendario> findByFechaInicio(LocalDate fechaInicio);
}
