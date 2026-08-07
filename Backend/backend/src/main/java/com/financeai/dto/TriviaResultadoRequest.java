package com.financeai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record TriviaResultadoRequest(@NotEmpty @Valid List<TriviaRespuestaDTO> respuestas) {}
