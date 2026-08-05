package com.financeai.dto;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifica que PagedResponse.from(...) mapee bien la metadata de un Page de Spring
 * (base de la paginación de transacciones).
 */
class PagedResponseTest {

    @Test
    void from_mapeaContenidoYMetadata() {
        // 5 elementos en total, página 0 de tamaño 2 → 3 páginas, no es la última.
        List<String> contenido = List.of("a", "b");
        Page<String> page = new PageImpl<>(contenido, PageRequest.of(0, 2), 5);

        PagedResponse<String> res = PagedResponse.from(page);

        assertThat(res.content()).containsExactly("a", "b");
        assertThat(res.page()).isZero();
        assertThat(res.size()).isEqualTo(2);
        assertThat(res.totalElements()).isEqualTo(5);
        assertThat(res.totalPages()).isEqualTo(3);
        assertThat(res.last()).isFalse();
    }

    @Test
    void from_ultimaPagina_marcaLastTrue() {
        // Página 2 (la tercera) con 1 elemento → es la última.
        Page<String> page = new PageImpl<>(List.of("e"), PageRequest.of(2, 2), 5);

        PagedResponse<String> res = PagedResponse.from(page);

        assertThat(res.page()).isEqualTo(2);
        assertThat(res.last()).isTrue();
    }
}
