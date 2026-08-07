package com.financeai.service;

import com.financeai.dto.ml.MlPredictResponse;
import com.financeai.dto.ml.MlTransaccion;
import com.financeai.model.Categoria;
import com.financeai.model.Transaccion;
import com.financeai.repository.CategoriaRepository;
import com.financeai.repository.TransaccionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReclasificacionService {

    private static final Logger log =
            LoggerFactory.getLogger(ReclasificacionService.class);

    private static final int LIMITE_MINIMO = 1;
    private static final int LIMITE_MAXIMO = 1000;
    private static final int LIMITE_POR_DEFECTO = 500;

    private final TransaccionRepository transaccionRepository;
    private final CategoriaRepository categoriaRepository;
    private final MlService mlService;

    public ReclasificacionService(
            TransaccionRepository transaccionRepository,
            CategoriaRepository categoriaRepository,
            MlService mlService) {

        this.transaccionRepository = transaccionRepository;
        this.categoriaRepository = categoriaRepository;
        this.mlService = mlService;
    }

    /**
     * Reclasifica todos los gastos de un usuario puntual.
     *
     * Este método se mantiene para pruebas o correcciones manuales de un usuario.
     */
    @Transactional
    public Map<String, Object> reclasificarUsuario(String usuarioId) {

        List<Transaccion> transacciones =
                transaccionRepository.findByUsuarioId(usuarioId);

        int procesadas = 0;
        int actualizadas = 0;
        int omitidas = 0;
        int errores = 0;

        List<Transaccion> modificadas = new ArrayList<>();

        for (Transaccion transaccion : transacciones) {

            if (!esGastoValido(transaccion)) {
                omitidas++;
                continue;
            }

            procesadas++;

            try {
                reclasificarTransaccion(transaccion);
                modificadas.add(transaccion);
                actualizadas++;

            } catch (Exception e) {
                errores++;

                log.error(
                        "Error reclasificando {}: {}",
                        transaccion.getId(),
                        e.getMessage()
                );
            }
        }

        if (!modificadas.isEmpty()) {
            transaccionRepository.saveAllAndFlush(modificadas);
        }

        Map<String, Object> resultado = new LinkedHashMap<>();

        resultado.put("usuarioId", usuarioId);
        resultado.put("transaccionesTotales", transacciones.size());
        resultado.put("gastosProcesados", procesadas);
        resultado.put("actualizadas", actualizadas);
        resultado.put("omitidas", omitidas);
        resultado.put("errores", errores);

        return resultado;
    }

    /**
     * Reclasifica un lote de gastos pendientes de toda la base.
     *
     * Solo procesa transacciones:
     * - de tipo Gasto;
     * - cuya subcategoría todavía sea null.
     *
     * De esta forma no toca ingresos, metas, gamificación, usuarios
     * ni ninguna otra tabla.
     */
    @Transactional
    public Map<String, Object> reclasificarPendientes(Integer limiteSolicitado) {

        int limite = normalizarLimite(limiteSolicitado);

        long pendientesAntes =
                transaccionRepository.countPendientesDeReclasificar();

        if (pendientesAntes == 0) {
            Map<String, Object> resultado = new LinkedHashMap<>();

            resultado.put("limite", limite);
            resultado.put("pendientesAntes", 0);
            resultado.put("procesadas", 0);
            resultado.put("actualizadas", 0);
            resultado.put("errores", 0);
            resultado.put("pendientes", 0);
            resultado.put("finalizado", true);

            return resultado;
        }

        List<Transaccion> lote =
                transaccionRepository.findPendientesDeReclasificar(
                        PageRequest.of(0, limite)
                );

        int procesadas = 0;
        int actualizadas = 0;
        int errores = 0;

        List<Transaccion> modificadas = new ArrayList<>();

        for (Transaccion transaccion : lote) {

            procesadas++;

            try {
                reclasificarTransaccion(transaccion);
                modificadas.add(transaccion);
                actualizadas++;

            } catch (Exception e) {
                errores++;

                log.error(
                        "Error reclasificando pendiente {}: {}",
                        transaccion.getId(),
                        e.getMessage()
                );
            }
        }

        if (!modificadas.isEmpty()) {
            transaccionRepository.saveAllAndFlush(modificadas);
        }

        long pendientesDespues =
                transaccionRepository.countPendientesDeReclasificar();

        Map<String, Object> resultado = new LinkedHashMap<>();

        resultado.put("limite", limite);
        resultado.put("pendientesAntes", pendientesAntes);
        resultado.put("procesadas", procesadas);
        resultado.put("actualizadas", actualizadas);
        resultado.put("errores", errores);
        resultado.put("pendientes", pendientesDespues);
        resultado.put("finalizado", pendientesDespues == 0);

        return resultado;
    }

    /**
     * Ejecuta la clasificación ML de una sola transacción
     * y aplica categoría + subcategoría sobre la entidad.
     */
    private void reclasificarTransaccion(Transaccion transaccion) {

        String categoriaActual =
                transaccion.getCategoria() != null
                        ? transaccion.getCategoria().getNombre()
                        : null;

        String medioPago =
                transaccion.getMedioPago() != null
                        && !transaccion.getMedioPago().isBlank()
                        ? transaccion.getMedioPago()
                        : "desconocido";

        String recurrente =
                Boolean.TRUE.equals(transaccion.getRecurrente())
                        ? "si"
                        : "no";

        MlTransaccion txMl = new MlTransaccion(
                transaccion.getFecha().toString(),
                transaccion.getDescripcion(),
                transaccion.getMonto(),
                categoriaActual,
                medioPago,
                recurrente
        );

        MlPredictResponse prediccion =
                mlService.predecirCategoria(txMl);

        if (prediccion == null
                || prediccion.getCategoriaPredicha() == null
                || prediccion.getCategoriaPredicha().isBlank()) {

            throw new IllegalStateException(
                    "El ML no devolvió una categoría válida."
            );
        }

        String categoriaPredicha =
                prediccion.getCategoriaPredicha().trim();

        String subcategoriaPredicha =
                prediccion.getSubcategoriaPredicha();

        if (subcategoriaPredicha == null
                || subcategoriaPredicha.isBlank()) {

            throw new IllegalStateException(
                    "El ML no devolvió una subcategoría válida."
            );
        }

        Categoria categoria =
                categoriaRepository
                        .findByNombreIgnoreCase(categoriaPredicha)
                        .orElseGet(() -> {

                            Categoria nueva = new Categoria();

                            nueva.setNombre(categoriaPredicha);
                            nueva.setDescripcion(
                                    "Categoría creada durante reclasificación"
                            );
                            nueva.setIcono("wallet");
                            nueva.setColor("#64748B");

                            return categoriaRepository.save(nueva);
                        });

        transaccion.setCategoria(categoria);
        transaccion.setSubcategoria(
                subcategoriaPredicha.trim()
        );

        log.debug(
                "Transacción {} reclasificada: {} / {}",
                transaccion.getId(),
                categoriaPredicha,
                subcategoriaPredicha
        );
    }

    /**
     * Valida que una transacción pueda ser enviada al ML.
     */
    private boolean esGastoValido(Transaccion transaccion) {

        if (transaccion == null) {
            return false;
        }

        if (transaccion.getTipo() == null
                || !transaccion.getTipo().equalsIgnoreCase("Gasto")) {

            return false;
        }

        return transaccion.getDescripcion() != null
                && !transaccion.getDescripcion().isBlank()
                && transaccion.getMonto() != null
                && transaccion.getFecha() != null;
    }

    /**
     * Evita lotes accidentales demasiado grandes.
     */
    private int normalizarLimite(Integer limiteSolicitado) {

        if (limiteSolicitado == null) {
            return LIMITE_POR_DEFECTO;
        }

        if (limiteSolicitado < LIMITE_MINIMO) {
            return LIMITE_MINIMO;
        }

        return Math.min(
                limiteSolicitado,
                LIMITE_MAXIMO
        );
    }
}