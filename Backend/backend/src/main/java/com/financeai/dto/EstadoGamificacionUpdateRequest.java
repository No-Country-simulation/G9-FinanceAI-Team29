package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EstadoGamificacionUpdateRequest(
    @NotBlank String weekKey,
    String challengesBaseline,
    int streak,
    int bestStreak,
    LocalDate lastActiveDate,
    int dailyStreak,
    int bestDailyStreak,
    int bestLevelSeen,
    LocalDateTime ultimaSubidaNivel,
    int puntos,
    int mensajesAsistente
) {}
