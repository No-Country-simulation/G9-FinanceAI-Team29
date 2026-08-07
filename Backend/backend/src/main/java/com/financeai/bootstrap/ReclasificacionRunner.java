package com.financeai.bootstrap;

import com.financeai.service.ReclasificacionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Runner TEMPORAL para completar categoría/subcategoría
 * de los gastos existentes que todavía tienen subcategoria = null.
 *
 * IMPORTANTE:
 * - No borra usuarios.
 * - No toca ingresos.
 * - No toca metas.
 * - No toca gamificación, logros ni trivia.
 * - Solo utiliza ReclasificacionService sobre gastos pendientes.
 *
 * Una vez terminado el backfill, este archivo debe eliminarse
 * para que no vuelva a ejecutarse en cada arranque.
 */
@Component
public class ReclasificacionRunner implements CommandLineRunner {

    private static final Logger log =
            LoggerFactory.getLogger(ReclasificacionRunner.class);

    private static final int TAMANO_LOTE = 500;

    private final ReclasificacionService reclasificacionService;

    public ReclasificacionRunner(
            ReclasificacionService reclasificacionService) {

        this.reclasificacionService = reclasificacionService;
    }

    @Override
    public void run(String... args) {

        long inicio = System.currentTimeMillis();

        int numeroLote = 0;
        long totalProcesadas = 0;
        long totalActualizadas = 0;
        long totalErrores = 0;

        log.info("====================================================");
        log.info("RECLASIFICACION MASIVA DE GASTOS PENDIENTES");
        log.info("Tamaño de lote: {}", TAMANO_LOTE);
        log.info("====================================================");

        while (true) {

            numeroLote++;

            Map<String, Object> resultado =
                    reclasificacionService.reclasificarPendientes(
                            TAMANO_LOTE
                    );

            long pendientesAntes =
                    numero(resultado.get("pendientesAntes"));

            long procesadas =
                    numero(resultado.get("procesadas"));

            long actualizadas =
                    numero(resultado.get("actualizadas"));

            long errores =
                    numero(resultado.get("errores"));

            long pendientes =
                    numero(resultado.get("pendientes"));

            boolean finalizado =
                    Boolean.TRUE.equals(resultado.get("finalizado"));

            totalProcesadas += procesadas;
            totalActualizadas += actualizadas;
            totalErrores += errores;

            log.info(
                    "Lote {} -> pendientes antes: {}, procesadas: {}, actualizadas: {}, errores: {}, pendientes: {}",
                    numeroLote,
                    pendientesAntes,
                    procesadas,
                    actualizadas,
                    errores,
                    pendientes
            );

            if (finalizado || pendientes == 0) {

                log.info("====================================================");
                log.info("RECLASIFICACION FINALIZADA");
                log.info("Lotes ejecutados: {}", numeroLote);
                log.info("Procesadas: {}", totalProcesadas);
                log.info("Actualizadas: {}", totalActualizadas);
                log.info("Errores: {}", totalErrores);
                log.info(
                        "Tiempo total: {} segundos",
                        (System.currentTimeMillis() - inicio) / 1000
                );
                log.info("====================================================");

                break;
            }

            /*
             * Protección: si un lote no pudo actualizar nada,
             * detener el proceso para evitar un bucle infinito
             * sobre las mismas filas pendientes.
             */
            if (actualizadas == 0) {

                log.error("====================================================");
                log.error("RECLASIFICACION DETENIDA");
                log.error(
                        "El lote {} no actualizó ninguna transacción.",
                        numeroLote
                );
                log.error(
                        "Quedan {} gastos pendientes. Revisá los errores antes de volver a ejecutar.",
                        pendientes
                );
                log.error("====================================================");

                break;
            }

            /*
             * Si hubo errores pero también hubo avances, detenemos igual.
             * Así no repetimos indefinidamente las mismas filas fallidas.
             */
            if (errores > 0) {

                log.error("====================================================");
                log.error("RECLASIFICACION PAUSADA POR ERRORES");
                log.error(
                        "El lote {} tuvo {} errores.",
                        numeroLote,
                        errores
                );
                log.error(
                        "Se actualizaron {} transacciones y quedan {} pendientes.",
                        actualizadas,
                        pendientes
                );
                log.error(
                        "Revisá el log antes de volver a arrancar el backend."
                );
                log.error("====================================================");

                break;
            }
        }
    }

    private long numero(Object valor) {

        if (valor instanceof Number numero) {
            return numero.longValue();
        }

        if (valor == null) {
            return 0L;
        }

        return Long.parseLong(valor.toString());
    }
}