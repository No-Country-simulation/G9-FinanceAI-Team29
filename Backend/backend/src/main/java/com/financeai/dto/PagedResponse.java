package com.financeai.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Respuesta paginada genérica y estable para la API.
 *
 * Evitamos serializar directamente el {@link Page} de Spring (su JSON es verboso
 * e inestable entre versiones). En su lugar exponemos solo lo que el front necesita:
 * el contenido de la página y la metadata para armar los controles.
 *
 * @param content       elementos de la página actual
 * @param page          número de página (base 0)
 * @param size          tamaño de página solicitado
 * @param totalElements total de elementos en todas las páginas
 * @param totalPages    cantidad total de páginas
 * @param last          true si es la última página
 */
public record PagedResponse<T>(
    List<T> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean last
) {
    /** Construye la respuesta a partir de un {@link Page} de Spring ya mapeado a DTOs. */
    public static <T> PagedResponse<T> from(Page<T> page) {
        return new PagedResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages(),
            page.isLast()
        );
    }
}
