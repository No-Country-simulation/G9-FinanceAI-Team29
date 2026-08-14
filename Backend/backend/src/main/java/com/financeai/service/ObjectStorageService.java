package com.financeai.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.util.UUID;

/**
 * Subida de archivos a Object Storage S3-compatible (OCI Object Storage / MinIO).
 *
 * <p>Configurable y con fallback: si faltan las variables de storage, queda deshabilitado
 * (no falla) y las features que lo usan (avatares) responden que no está disponible. Así en
 * local anda sin bucket; en OCI se setean el endpoint y las Customer Secret Keys.
 */
@Service
public class ObjectStorageService {

    private static final Logger log = LoggerFactory.getLogger(ObjectStorageService.class);

    private final boolean habilitado;
    private final String avatarsBucket;
    private final String avatarsPublicBaseUrl;
    private S3Client s3;

    public ObjectStorageService(
            @Value("${app.storage.s3.endpoint:}") String endpoint,
            @Value("${app.storage.s3.region:us-east-1}") String region,
            @Value("${app.storage.s3.access-key:}") String accessKey,
            @Value("${app.storage.s3.secret-key:}") String secretKey,
            @Value("${app.storage.avatars-bucket:finsight-avatars}") String avatarsBucket,
            @Value("${app.storage.avatars-public-base-url:}") String avatarsPublicBaseUrl
    ) {
        this.avatarsBucket = avatarsBucket;
        this.avatarsPublicBaseUrl = avatarsPublicBaseUrl.replaceAll("/+$", "");
        this.habilitado = !endpoint.isBlank() && !accessKey.isBlank() && !secretKey.isBlank()
                && !avatarsPublicBaseUrl.isBlank();

        if (habilitado) {
            try {
                this.s3 = S3Client.builder()
                        .endpointOverride(URI.create(endpoint))
                        .region(Region.of(region))
                        .forcePathStyle(true) // MinIO y OCI usan path-style
                        .credentialsProvider(StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(accessKey, secretKey)))
                        .build();
                log.info("[storage] Object Storage habilitado (bucket avatares: {}).", avatarsBucket);
            } catch (Exception e) {
                log.error("[storage] No se pudo inicializar el cliente S3: {}", e.getMessage());
                this.s3 = null;
            }
        } else {
            log.info("[storage] Object Storage deshabilitado (faltan variables) — sin subida de avatares.");
        }
    }

    public boolean estaHabilitado() {
        return habilitado && s3 != null;
    }

    /** Sube la imagen del avatar y devuelve su URL pública. */
    public String subirAvatar(String usuarioId, byte[] contenido, String contentType, String extension) {
        if (!estaHabilitado()) {
            throw new IllegalStateException("El almacenamiento de archivos no está configurado.");
        }
        String key = "avatars/" + usuarioId + "/" + UUID.randomUUID() + "." + extension;
        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(avatarsBucket)
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromBytes(contenido));
        return avatarsPublicBaseUrl + "/" + key;
    }
}
