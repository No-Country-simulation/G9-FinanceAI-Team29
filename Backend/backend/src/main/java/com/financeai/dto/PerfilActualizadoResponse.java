package com.financeai.dto;

/**
 * Respuesta del PATCH /api/usuarios/{id}/perfil.
 *
 * Tipada (no un Map genérico) para que sea clara, auto-documentada en Swagger y
 * tolere valores null. En particular, {@code email} puede ser null (las cuentas
 * demo no tienen email real) — un record lo acepta sin problemas, a diferencia de
 * {@code Map.of(...)} que lanza NullPointerException con valores null.
 *
 * @param mensaje  texto de confirmación
 * @param nombre   nombre actualizado
 * @param apellido apellido actualizado
 * @param email    email del usuario (puede ser null)
 */
public record PerfilActualizadoResponse(
    String mensaje,
    String nombre,
    String apellido,
    String email
) {}
