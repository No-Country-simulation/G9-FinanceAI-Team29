package com.financeai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registra el {@link OwnershipInterceptor} sobre los endpoints por usuario.
 * (El CORS vive en SecurityConfig; acá solo van interceptores de MVC.)
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final OwnershipInterceptor ownershipInterceptor;

    public WebMvcConfig(OwnershipInterceptor ownershipInterceptor) {
        this.ownershipInterceptor = ownershipInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(ownershipInterceptor)
                .addPathPatterns("/api/usuarios/**");
    }
}
