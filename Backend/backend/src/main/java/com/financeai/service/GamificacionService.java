package com.financeai.service;

import com.financeai.dto.*;
import com.financeai.model.EstadoGamificacion;
import com.financeai.model.LogroDesbloqueado;
import com.financeai.model.RetoProgreso;
import com.financeai.model.TriviaResultado;
import com.financeai.model.Usuario;
import com.financeai.repository.EstadoGamificacionRepository;
import com.financeai.repository.LogroDesbloqueadoRepository;
import com.financeai.repository.RetoProgresoRepository;
import com.financeai.repository.TriviaResultadoRepository;
import com.financeai.repository.UsuarioRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class GamificacionService {

    private final RetoProgresoRepository retoProgresoRepository;
    private final TriviaResultadoRepository triviaResultadoRepository;
    private final LogroDesbloqueadoRepository logroDesbloqueadoRepository;
    private final EstadoGamificacionRepository estadoGamificacionRepository;
    private final UsuarioRepository usuarioRepository;

    public GamificacionService(
            RetoProgresoRepository retoProgresoRepository,
            TriviaResultadoRepository triviaResultadoRepository,
            LogroDesbloqueadoRepository logroDesbloqueadoRepository,
            EstadoGamificacionRepository estadoGamificacionRepository,
            UsuarioRepository usuarioRepository
    ) {
        this.retoProgresoRepository = retoProgresoRepository;
        this.triviaResultadoRepository = triviaResultadoRepository;
        this.logroDesbloqueadoRepository = logroDesbloqueadoRepository;
        this.estadoGamificacionRepository = estadoGamificacionRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<RetoProgresoResponse> listarRetos(String usuarioId, String semanaIso) {
        requireUser(usuarioId);
        return retoProgresoRepository.findByUsuarioIdAndSemanaIso(usuarioId, semanaIso).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RetoProgresoResponse guardarReto(String usuarioId, String retoId, RetoProgresoUpdateRequest request) {
        Usuario usuario = requireUser(usuarioId);
        RetoProgreso reto = retoProgresoRepository
                .findByUsuarioIdAndRetoIdAndSemanaIso(usuarioId, retoId, request.semanaIso())
                .orElseGet(() -> {
                    RetoProgreso nuevo = new RetoProgreso();
                    nuevo.setUsuario(usuario);
                    nuevo.setRetoId(retoId);
                    nuevo.setSemanaIso(request.semanaIso());
                    return nuevo;
                });
        reto.setCompletado(request.completado());
        reto.setProgreso(request.progreso());
        return toResponse(retoProgresoRepository.save(reto));
    }

    @Transactional(readOnly = true)
    public TriviaEstadisticasResponse obtenerEstadisticasTrivia(String usuarioId) {
        requireUser(usuarioId);
        List<TriviaResultado> resultados = triviaResultadoRepository.findByUsuarioIdOrderByRespondidoAtDesc(usuarioId);
        if (resultados.isEmpty()) {
            return new TriviaEstadisticasResponse(0, 0, null, true);
        }

        Map<LocalDate, List<TriviaResultado>> porDia = resultados.stream()
                .collect(Collectors.groupingBy(r -> r.getRespondidoAt().toLocalDate()));

        List<LocalDate> dias = new ArrayList<>(porDia.keySet());
        dias.sort(LocalDate::compareTo);

        int bestScore = 0;
        int correctStreak = 0;
        for (LocalDate dia : dias) {
            List<TriviaResultado> delDia = porDia.get(dia);
            long aciertos = delDia.stream().filter(TriviaResultado::isCorrecta).count();
            bestScore = Math.max(bestScore, (int) aciertos);
            correctStreak = (aciertos == delDia.size()) ? correctStreak + 1 : 0;
        }

        LocalDate ultimoDia = dias.get(dias.size() - 1);
        boolean canPlayToday = !ultimoDia.isEqual(LocalDate.now());
        return new TriviaEstadisticasResponse(bestScore, correctStreak, ultimoDia, canPlayToday);
    }

    @Transactional(readOnly = true)
    public Optional<EstadoGamificacionResponse> obtenerEstado(String usuarioId) {
        requireUser(usuarioId);
        return estadoGamificacionRepository.findById(usuarioId).map(this::toResponse);
    }

    @Transactional
    public EstadoGamificacionResponse guardarEstado(String usuarioId, EstadoGamificacionUpdateRequest request) {
        Usuario usuario = requireUser(usuarioId);
        EstadoGamificacion estado = estadoGamificacionRepository.findById(usuarioId)
                .orElseGet(() -> {
                    EstadoGamificacion nuevo = new EstadoGamificacion();
                    nuevo.setUsuario(usuario);
                    return nuevo;
                });
        estado.setWeekKey(request.weekKey());
        estado.setChallengesBaseline(request.challengesBaseline());
        estado.setStreak(request.streak());
        estado.setBestStreak(request.bestStreak());
        estado.setLastActiveDate(request.lastActiveDate());
        estado.setDailyStreak(request.dailyStreak());
        estado.setBestDailyStreak(request.bestDailyStreak());
        estado.setBestLevelSeen(request.bestLevelSeen());
        estado.setUltimaSubidaNivel(request.ultimaSubidaNivel());
        estado.setPuntos(request.puntos());
        estado.setMensajesAsistente(request.mensajesAsistente());
        return toResponse(estadoGamificacionRepository.save(estado));
    }

    @Transactional
    public void registrarResultadosTrivia(String usuarioId, TriviaResultadoRequest request) {
        Usuario usuario = requireUser(usuarioId);
        List<TriviaResultado> resultados = request.respuestas().stream().map(r -> {
            TriviaResultado resultado = new TriviaResultado();
            resultado.setUsuario(usuario);
            resultado.setPreguntaId(r.preguntaId());
            resultado.setCorrecta(r.correcta());
            return resultado;
        }).toList();
        triviaResultadoRepository.saveAll(resultados);
    }

    @Transactional(readOnly = true)
    public List<LogroResponse> listarLogros(String usuarioId) {
        requireUser(usuarioId);
        return logroDesbloqueadoRepository.findByUsuarioId(usuarioId).stream()
                .map(l -> new LogroResponse(l.getLogroId(), l.getDesbloqueadoAt()))
                .toList();
    }

    /**
     * Sin @Transactional a nivel de método a propósito: cada llamada al repositorio ya
     * corre en su propia transacción (Spring Data), así que un fallo en el insert no
     * deja nada a medio camino y el catch de abajo puede seguir consultando con
     * normalidad. Esto es el "cinturón de seguridad" ante dos requests concurrentes que
     * intentan desbloquear el mismo logro (la constraint UNIQUE(usuario_id, logro_id)
     * en la tabla hace que el segundo insert falle en vez de duplicar la fila).
     */
    public LogroResponse desbloquearLogro(String usuarioId, String logroId) {
        Optional<LogroDesbloqueado> existente = logroDesbloqueadoRepository.findByUsuarioIdAndLogroId(usuarioId, logroId);
        if (existente.isPresent()) {
            return toResponse(existente.get());
        }

        Usuario usuario = requireUser(usuarioId);
        LogroDesbloqueado nuevo = new LogroDesbloqueado();
        nuevo.setUsuario(usuario);
        nuevo.setLogroId(logroId);
        try {
            return toResponse(logroDesbloqueadoRepository.save(nuevo));
        } catch (DataIntegrityViolationException e) {
            return logroDesbloqueadoRepository.findByUsuarioIdAndLogroId(usuarioId, logroId)
                    .map(this::toResponse)
                    .orElseThrow(() -> e);
        }
    }

    private Usuario requireUser(String id) {
        return usuarioRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado."));
    }

    private LogroResponse toResponse(LogroDesbloqueado logro) {
        return new LogroResponse(logro.getLogroId(), logro.getDesbloqueadoAt());
    }

    private RetoProgresoResponse toResponse(RetoProgreso reto) {
        return new RetoProgresoResponse(reto.getRetoId(), reto.getSemanaIso(), reto.isCompletado(), reto.getProgreso(), reto.getActualizadoAt());
    }

    private EstadoGamificacionResponse toResponse(EstadoGamificacion estado) {
        return new EstadoGamificacionResponse(
            estado.getWeekKey(), estado.getChallengesBaseline(), estado.getStreak(), estado.getBestStreak(),
            estado.getLastActiveDate(), estado.getDailyStreak(), estado.getBestDailyStreak(),
            estado.getBestLevelSeen(), estado.getUltimaSubidaNivel(), estado.getPuntos(),
            estado.getMensajesAsistente()
        );
    }
}
