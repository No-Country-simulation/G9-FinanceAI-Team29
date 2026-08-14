package com.financeai.service;

import nl.martijndwars.webpush.Notification;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Security;

/**
 * Envío de Web Push (VAPID) — reemplaza al {@code web-push} de la función serverless de Vercel.
 *
 * <p>Si no hay claves VAPID configuradas (típico en local), queda deshabilitado y no falla:
 * los recordatorios se mandan solo por email. En OCI se setean VAPID_PUBLIC_KEY/PRIVATE_KEY.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    private final boolean habilitado;
    private nl.martijndwars.webpush.PushService delegate;

    public PushService(
            @Value("${app.push.vapid-public-key:}") String publicKey,
            @Value("${app.push.vapid-private-key:}") String privateKey,
            @Value("${app.push.vapid-subject:mailto:soporte@finsightai.com}") String subject
    ) {
        this.habilitado = publicKey != null && !publicKey.isBlank()
                && privateKey != null && !privateKey.isBlank();

        if (habilitado) {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            try {
                this.delegate = new nl.martijndwars.webpush.PushService(publicKey, privateKey, subject);
                log.info("[push] Web Push habilitado (VAPID configurado).");
            } catch (Exception e) {
                log.error("[push] No se pudo inicializar Web Push: {}", e.getMessage());
                this.delegate = null;
            }
        } else {
            log.info("[push] Web Push deshabilitado (sin VAPID) — los recordatorios van solo por email.");
        }
    }

    public boolean estaHabilitado() {
        return habilitado && delegate != null;
    }

    /**
     * Envía una notificación push. Devuelve el código HTTP de la respuesta del push service
     * (201 típico si se aceptó; 404/410 si la suscripción ya no existe). -1 si no se pudo enviar.
     */
    public int enviar(String endpoint, String p256dh, String auth, String payloadJson) {
        if (!estaHabilitado()) {
            return -1;
        }
        try {
            Notification notification = new Notification(
                    endpoint, p256dh, auth, payloadJson.getBytes(StandardCharsets.UTF_8));
            HttpResponse response = delegate.send(notification);
            return response.getStatusLine().getStatusCode();
        } catch (Exception e) {
            log.warn("[push] Error enviando push a {}: {}", endpoint, e.getMessage());
            return -1;
        }
    }
}
