package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;

public record TriviaRespuestaDTO(@NotBlank String preguntaId, boolean correcta) {}
