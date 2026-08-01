package com.financeai.service;

import com.financeai.dto.ml.MlAnalysisRequest;
import com.financeai.dto.ml.MlAnalysisResponse;
import com.financeai.dto.ml.MlPredictResponse;
import com.financeai.dto.ml.MlTransaccion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Cliente HTTP para hablar con el microservicio de ML (FastAPI).
 * La idea es que nunca reviente: si el ML está apagado o no contesta,
 * estaDisponible() devuelve false y AnalisisService se va a las reglas internas.
 * O sea, la app sigue funcionando aunque el ML esté caído.
 */
@Service
public class MlService {

    private static final Logger log = LoggerFactory.getLogger(MlService.class);

    private final boolean enabled;
    private final RestClient client;

    public MlService(
            @Value("${ml.service.enabled:true}") boolean enabled,
            @Value("${ml.service.url:http://127.0.0.1:8000}") String baseUrl,
            @Value("${ml.service.connect-timeout-ms:2000}") int connectTimeoutMs,
            @Value("${ml.service.read-timeout-ms:5000}") int readTimeoutMs) {

        this.enabled = enabled;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);

        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Ping al ML para ver si está vivo (GET /health).
     * No lanza nada: si algo falla, devuelve false y listo.
     */
    public boolean estaDisponible() {
        if (!enabled) {
            return false;
        }
        try {
            Map<?, ?> res = client.get()
                    .uri("/health")
                    .retrieve()
                    .body(Map.class);
            return res != null && "ok".equals(res.get("status"));
        } catch (Exception e) {
            log.warn("El microservicio de ML no está disponible: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Le pide al ML que clasifique una transacción (POST /predict/category).
     * Devuelve la categoría con su confianza; quien llama decide si le sirve o se
     * queda con las reglas. Ojo: puede lanzar excepción si el servicio falla.
     */
    public MlPredictResponse predecirCategoria(MlTransaccion tx) {
        MlPredictResponse res = client.post()
                .uri("/predict/category")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "descripcion", tx.getDescripcion(),
                        "monto", tx.getMonto(),
                        "fecha", tx.getFecha(),
                        "medio_pago", tx.getMedioPago(),
                        "recurrente", tx.getRecurrente()))
                .retrieve()
                .body(MlPredictResponse.class);

        if (res == null || res.getCategoriaPredicha() == null) {
            throw new IllegalStateException("El ML no devolvió categoría");
        }
        return res;
    }

    /**
     * Análisis completo del perfil con el ML (POST /analysis).
     * Puede tirar excepción si el servicio falla; el fallback lo maneja quien llama.
     */
    public MlAnalysisResponse analizar(MlAnalysisRequest request) {
        MlAnalysisResponse res = client.post()
                .uri("/analysis")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(MlAnalysisResponse.class);

        if (res == null || res.getPerfilFinanciero() == null) {
            throw new IllegalStateException("El ML no devolvió un análisis válido");
        }
        return res;
    }
}
