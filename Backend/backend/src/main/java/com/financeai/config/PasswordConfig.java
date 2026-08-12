package com.financeai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Encoder de contraseñas (bcrypt) para el auth propio del backend.
 * bcrypt genera un salt aleatorio por contraseña → hashes irrepetibles.
 * Compatible con los hashes que guardaba Supabase (mismo algoritmo).
 */
@Configuration
public class PasswordConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
