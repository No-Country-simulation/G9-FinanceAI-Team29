package com.financeai.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Envío de correos vía Resend (reemplaza el envío que hacían las funciones serverless de Vercel).
 *
 * <p>Si no hay {@code RESEND_API_KEY} configurada (típico en local), no falla: loguea el enlace
 * para poder probar el flujo de reset de punta a punta sin un servicio de correo real.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final String apiKey;
    private final String from;
    private final String logoUrl;
    private final RestClient client;

    public EmailService(
            @Value("${app.email.resend-api-key:}") String apiKey,
            @Value("${app.email.from:FinSightAI <onboarding@resend.dev>}") String from,
            @Value("${app.email.logo-url:}") String logoUrl
    ) {
        this.apiKey = apiKey;
        this.from = from;
        this.logoUrl = logoUrl;
        this.client = RestClient.builder().baseUrl("https://api.resend.com").build();
    }

    /** Envía el correo de restablecimiento de contraseña con el enlace al frontend. */
    public void enviarResetPassword(String to, String nombre, String resetUrl) {
        String saludo = (nombre != null && !nombre.isBlank()) ? nombre.trim() : "Hola";
        enviar(to, "Restablecé tu contraseña de FinSightAI", htmlReset(saludo, resetUrl));
    }

    private void enviar(String to, String subject, String html) {
        if (apiKey == null || apiKey.isBlank()) {
            // Modo dev: sin proveedor de correo. No enviamos, pero dejamos rastro para probar.
            log.warn("[email] RESEND_API_KEY no configurada — no se envía el correo a {}. "
                    + "Asunto: '{}'. (Revisá el enlace en los logs de arriba para probar el flujo.)",
                    to, subject);
            return;
        }
        try {
            client.post()
                    .uri("/emails")
                    .header("Authorization", "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("from", from, "to", to, "subject", subject, "html", html))
                    .retrieve()
                    .toBodilessEntity();
            log.info("[email] Correo '{}' enviado a {}.", subject, to);
        } catch (Exception e) {
            log.error("[email] Resend rechazó el envío a {}: {}", to, e.getMessage());
            throw new IllegalStateException("No se pudo enviar el correo.", e);
        }
    }

    private String htmlReset(String saludo, String resetUrl) {
        String logo = (logoUrl == null || logoUrl.isBlank())
                ? ""
                : "<img src=\"" + logoUrl + "\" alt=\"FinSightAI\" height=\"48\" style=\"margin-bottom:16px\"/>";
        return """
            <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">
              %s
              <h1 style="font-size:20px;margin:0 0 12px">Restablecé tu contraseña</h1>
              <p style="font-size:14px;line-height:1.6;margin:0 0 16px">Hola %s, recibimos un pedido para restablecer la contraseña de tu cuenta de FinSightAI. Hacé clic en el botón para elegir una nueva:</p>
              <p style="margin:24px 0">
                <a href="%s" style="background:#465fff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block">Restablecer contraseña</a>
              </p>
              <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 8px">Si no pediste esto, podés ignorar este correo: tu contraseña no cambia hasta que uses el enlace.</p>
              <p style="font-size:12px;line-height:1.6;color:#6b7280;margin:0">El enlace vence en 1 hora. Si el botón no funciona, copiá y pegá esta dirección:<br><span style="color:#465fff;word-break:break-all">%s</span></p>
            </div>
            """.formatted(logo, saludo, resetUrl, resetUrl);
    }
}
