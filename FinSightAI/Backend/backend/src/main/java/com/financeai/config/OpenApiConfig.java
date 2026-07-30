package com.financeai.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Metadatos de la documentación OpenAPI (Swagger UI en /swagger-ui.html). */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI financeAiOpenAPI() {
        return new OpenAPI().info(new Info()
            .title("FinanceAI API")
            .version("0.0.1")
            .description("API REST de análisis de salud financiera — Hackathon Alura + Oracle")
            .contact(new Contact().name("Equipo FinanceAI")));
    }
}
