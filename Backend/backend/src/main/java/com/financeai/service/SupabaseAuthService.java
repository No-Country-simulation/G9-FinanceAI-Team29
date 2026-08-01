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

@Service
public class SupabaseAuthService {
    @Value("${supabase.url}")
    private String supabaseUrl; // Ej: https://xyz.supabase.co

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey; // Tu clave Secret Service Role desde el panel de Supabase

    public String crearUsuarioEnAuthSupabase(String email, String password, String displayName) {
        RestTemplate restTemplate = new RestTemplate();
        String url = supabaseUrl + "/auth/v1/admin/users";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("apikey", serviceRoleKey);
        headers.set("Authorization", "Bearer " + serviceRoleKey);

        Map<String, Object> userMetadata = new HashMap<>();
        userMetadata.put("display_name", displayName);

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
}
