package com.financeai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class SupabaseAuthService {
    @Value("${supabase.url}")
    private String supabaseUrl; // Ej: https://xyz.supabase.co

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey; // Tu clave Secret Service Role desde el panel de Supabase

    // Patrón Regex estándar para identificar un UUID (formato de authUserId / uid)
    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");


//    public String crearUsuarioEnAuthSupabase(String email, String password, String displayName) {
//        RestTemplate restTemplate = new RestTemplate();
//        String url = supabaseUrl + "/auth/v1/admin/users";
//
//        HttpHeaders headers = new HttpHeaders();
//        headers.setContentType(MediaType.APPLICATION_JSON);
//        headers.set("apikey", serviceRoleKey);
//        headers.set("Authorization", "Bearer " + serviceRoleKey);
//
//        Map<String, Object> userMetadata = new HashMap<>();
//        userMetadata.put("display_name", displayName);
//
//        Map<String, Object> requestBody = new HashMap<>();
//        requestBody.put("email", email);
//        requestBody.put("password", password);
//        requestBody.put("email_confirm", true);
//        requestBody.put("user_metadata", userMetadata);
//
//        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
//
//        ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
//
//        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
//            // Retorna el ID (UUID) generado en auth.users
//            return (String) response.getBody().get("id");
//        } else {
//            throw new RuntimeException("Error al crear usuario en Supabase Auth");
//        }
//    }

    public String crearUsuarioEnAuthSupabase(String email, String password, String nombre, String apellido) {
        RestTemplate restTemplate = new RestTemplate();
        String url = supabaseUrl + "/auth/v1/admin/users";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", serviceRoleKey);
        headers.set("Authorization", "Bearer " + serviceRoleKey);

        // nombre/apellido en claves separadas para que las plantillas de correo de
        // Supabase (que no soportan condicionales) puedan usar {{ .Data.nombre }}
        // igual que en el registro hecho desde el frontend (SignUpForm).

        Map<String, Object> userMetadata = new HashMap<>();
        userMetadata.put("nombre", nombre);
        userMetadata.put("apellido", apellido);
        userMetadata.put("display_name", (nombre + " " + apellido).trim());

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("email", email);
        requestBody.put("password", password);
        requestBody.put("email_confirm", true);
        requestBody.put("user_metadata", userMetadata);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            // Retorna el ID (UUID) generado en auth.users
            return (String) response.getBody().get("id");
        } else {
            throw new RuntimeException("Error al crear usuario en Supabase Auth");
        }
    }
    /**
     * Actualiza el email de un usuario ya existente en Supabase Auth (auth.users)
     * usando la Admin API. Requiere el authUserId (UUID), no el ID local (USR0001).
     */
    public void actualizarEmailEnSupabase(String authUserId, String nuevoEmail) {
        RestTemplate restTemplate = new RestTemplate();
        String url = supabaseUrl + "/auth/v1/admin/users/" + authUserId;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", serviceRoleKey);
        headers.set("Authorization", "Bearer " + serviceRoleKey);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("email", nuevoEmail);
        requestBody.put("email_confirm", true);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, org.springframework.http.HttpMethod.PUT, entity, Map.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Supabase rechazó la actualización de email.");
            }
        } catch (Exception e) {
            throw new RuntimeException("No se pudo actualizar el email en Supabase Auth: " + e.getMessage());
        }
    }

    /**
     * Actualiza nombre/apellido en el user_metadata de Supabase Auth (auth.users)
     * usando la Admin API, para mantenerlo sincronizado con la tabla local de usuarios.
     * Requiere el authUserId (UUID), no el ID local (USR0001).
     */
    public void actualizarNombreEnSupabase(String authUserId, String nombre, String apellido) {
        RestTemplate restTemplate = new RestTemplate();
        String url = supabaseUrl + "/auth/v1/admin/users/" + authUserId;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", serviceRoleKey);
        headers.set("Authorization", "Bearer " + serviceRoleKey);

        Map<String, Object> userMetadata = new HashMap<>();
        userMetadata.put("nombre", nombre);
        userMetadata.put("apellido", apellido);
        userMetadata.put("display_name", (nombre + " " + apellido).trim());

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("user_metadata", userMetadata);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, org.springframework.http.HttpMethod.PUT, entity, Map.class);

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("Supabase rechazó la actualización de nombre.");
            }
        } catch (Exception e) {
            throw new RuntimeException("No se pudo actualizar el nombre en Supabase Auth: " + e.getMessage());
        }
    }

    public String autenticarYObtenerUid(String email, String password) {
        RestTemplate restTemplate = new RestTemplate();
        // Endpoint estándar de Supabase GoTrue Auth para login con contraseña
        String url = supabaseUrl + "/auth/v1/token?grant_type=password";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", serviceRoleKey);

        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("email", email);
        requestBody.put("password", password);

        HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                // Supabase devuelve un objeto "user" dentro del cual está el "id" (UID)
                Map<String, Object> userMap = (Map<String, Object>) response.getBody().get("user");
                if (userMap != null) {
                    return (String) userMap.get("id");
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Credenciales inválidas en Supabase.");
        }

        throw new RuntimeException("No se pudo obtener el perfil de autenticación.");
    }


}
