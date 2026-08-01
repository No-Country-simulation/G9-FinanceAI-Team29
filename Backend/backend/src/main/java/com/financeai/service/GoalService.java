package com.financeai.service;

import com.financeai.dto.*;
import com.financeai.model.Goal;
import com.financeai.model.Usuario;
import com.financeai.repository.GoalRepository;
import com.financeai.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class GoalService {
    private static final List<String> CATEGORIES = List.of("COMPRA", "DEUDA", "AHORRO", "EMERGENCIA", "VIAJE", "OTRO");
    private static final List<String> STATUSES = List.of("ACTIVA", "COMPLETADA", "CANCELADA");

    private final GoalRepository goalRepository;
    private final UsuarioRepository usuarioRepository;

    public GoalService(GoalRepository goalRepository, UsuarioRepository usuarioRepository) {
        this.goalRepository = goalRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<GoalResponse> list(String usuarioId, String estado) {
        requireUser(usuarioId);
        if (estado == null || estado.isBlank()) {
            return goalRepository.findByUsuarioIdOrderByFechaCreacionDesc(usuarioId).stream().map(this::toResponse).toList();
        }
        String normalized = estado.toUpperCase();
        if (!STATUSES.contains(normalized)) throw new IllegalArgumentException("Estado de meta inválido.");
        return goalRepository.findByUsuarioIdAndEstadoOrderByFechaCreacionDesc(usuarioId, normalized).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public GoalResponse get(String usuarioId, String goalId) { return toResponse(requireOwned(usuarioId, goalId)); }

    @Transactional
    public GoalResponse create(String usuarioId, GoalCreateRequest request) {
        Usuario user = requireUser(usuarioId);
        Goal goal = new Goal();
        goal.setUsuario(user);
        goal.setNombre(request.nombre().trim());
        goal.setDescripcion(blankToNull(request.descripcion()));
        goal.setCategoria(category(request.categoria()));
        goal.setMontoObjetivo(request.montoObjetivo().setScale(2, RoundingMode.HALF_UP));
        goal.setMontoReservado(BigDecimal.ZERO.setScale(2));
        goal.setFechaObjetivo(request.fechaObjetivo());
        goal.setEstado("ACTIVA");
        return toResponse(goalRepository.save(goal));
    }

    @Transactional
    public GoalResponse update(String usuarioId, String goalId, GoalUpdateRequest request) {
        Goal goal = requireOwned(usuarioId, goalId);
        if ("CANCELADA".equals(goal.getEstado())) throw new IllegalArgumentException("No se puede editar una meta cancelada.");
        if (request.nombre() != null) goal.setNombre(request.nombre().trim());
        if (request.descripcion() != null) goal.setDescripcion(blankToNull(request.descripcion()));
        if (request.categoria() != null) goal.setCategoria(category(request.categoria()));
        if (request.montoObjetivo() != null) {
            BigDecimal target = request.montoObjetivo().setScale(2, RoundingMode.HALF_UP);
            if (target.compareTo(goal.getMontoReservado()) < 0) throw new IllegalArgumentException("El objetivo no puede ser menor que el monto reservado.");
            goal.setMontoObjetivo(target);
        }
        if (request.fechaObjetivo() != null) goal.setFechaObjetivo(request.fechaObjetivo());
        goal.setEstado(status(goal));
        return toResponse(goalRepository.save(goal));
    }

    @Transactional
    public GoalResponse addSavings(String usuarioId, String goalId, BigDecimal amount) {
        Goal goal = requireOwned(usuarioId, goalId);
        if (!"ACTIVA".equals(goal.getEstado())) throw new IllegalArgumentException("Solo se puede agregar ahorro a metas activas.");
        BigDecimal value = amount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal remaining = goal.getMontoObjetivo().subtract(goal.getMontoReservado());
        if (value.compareTo(remaining) > 0) throw new IllegalArgumentException("El monto supera lo necesario para completar la meta.");
        goal.setMontoReservado(goal.getMontoReservado().add(value));
        goal.setEstado(status(goal));
        return toResponse(goalRepository.save(goal));
    }

    /** Compatibilidad temporal con clientes anteriores. */
    @Transactional
    public GoalResponse reserve(String usuarioId, String goalId, BigDecimal amount) {
        return addSavings(usuarioId, goalId, amount);
    }

    @Transactional
    public GoalResponse release(String usuarioId, String goalId, BigDecimal amount) {
        Goal goal = requireOwned(usuarioId, goalId);
        if ("CANCELADA".equals(goal.getEstado())) throw new IllegalArgumentException("No se puede liberar dinero de una meta cancelada.");
        BigDecimal value = amount.setScale(2, RoundingMode.HALF_UP);
        if (value.compareTo(goal.getMontoReservado()) > 0) throw new IllegalArgumentException("No se puede liberar más dinero del reservado.");
        goal.setMontoReservado(goal.getMontoReservado().subtract(value));
        goal.setEstado(status(goal));
        return toResponse(goalRepository.save(goal));
    }

    @Transactional
    public GoalResponse cancel(String usuarioId, String goalId) {
        Goal goal = requireOwned(usuarioId, goalId);
        goal.setEstado("CANCELADA");
        return toResponse(goalRepository.save(goal));
    }

    @Transactional(readOnly = true)
    public GoalSummaryResponse summary(String usuarioId) {
        Usuario user = requireUser(usuarioId);
        List<Goal> goals = goalRepository.findByUsuarioIdOrderByFechaCreacionDesc(usuarioId);
        BigDecimal totalReserved = goals.stream().filter(g -> !"CANCELADA".equals(g.getEstado()))
            .map(Goal::getMontoReservado).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal balance = user.getAhorroMensualEstimado() == null ? BigDecimal.ZERO : user.getAhorroMensualEstimado().max(BigDecimal.ZERO);
        BigDecimal available = balance.subtract(totalReserved).max(BigDecimal.ZERO);
        BigDecimal percentage = balance.signum() == 0 ? BigDecimal.ZERO : totalReserved.multiply(BigDecimal.valueOf(100)).divide(balance, 2, RoundingMode.HALF_UP);
        return new GoalSummaryResponse(usuarioId, balance, totalReserved, available,
            goals.stream().filter(g -> "ACTIVA".equals(g.getEstado())).count(),
            goals.stream().filter(g -> "COMPLETADA".equals(g.getEstado())).count(), percentage);
    }

    private Usuario requireUser(String id) { return usuarioRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado.")); }
    private Goal requireOwned(String userId, String goalId) {
        Goal goal = goalRepository.findById(goalId).orElseThrow(() -> new IllegalArgumentException("Meta no encontrada."));
        if (!goal.getUsuario().getId().equals(userId)) throw new IllegalArgumentException("La meta no pertenece al usuario.");
        return goal;
    }
    private BigDecimal availableBalance(String userId) { return summary(userId).saldoDisponible(); }
    private String category(String value) {
        String normalized = value == null ? "OTRO" : value.trim().toUpperCase();
        if (!CATEGORIES.contains(normalized)) throw new IllegalArgumentException("Categoría de meta inválida.");
        return normalized;
    }
    private String status(Goal goal) { return goal.getMontoReservado().compareTo(goal.getMontoObjetivo()) >= 0 ? "COMPLETADA" : "ACTIVA"; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private GoalResponse toResponse(Goal goal) {
        BigDecimal remaining = goal.getMontoObjetivo().subtract(goal.getMontoReservado()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal progress = goal.getMontoObjetivo().signum() == 0 ? BigDecimal.ZERO : goal.getMontoReservado().multiply(BigDecimal.valueOf(100)).divide(goal.getMontoObjetivo(), 2, RoundingMode.HALF_UP).min(BigDecimal.valueOf(100));
        BigDecimal monthly = null;
        if (goal.getFechaObjetivo() != null && remaining.signum() > 0) {
            long months = Math.max(1, ChronoUnit.MONTHS.between(LocalDate.now().withDayOfMonth(1), goal.getFechaObjetivo().withDayOfMonth(1)));
            monthly = remaining.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
        }
        return new GoalResponse(goal.getId(), goal.getUsuario().getId(), goal.getNombre(), goal.getDescripcion(), goal.getCategoria(),
            goal.getMontoObjetivo(), goal.getMontoReservado(), remaining, progress, goal.getFechaObjetivo(), monthly,
            goal.getEstado(), goal.getFechaCreacion(), goal.getFechaActualizacion());
    }
}
