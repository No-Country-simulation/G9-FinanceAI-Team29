package com.financeai.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EstadoGamificacionResponse(
    String weekKey,
    String challengesBaseline,
    int streak,
    int bestStreak,
    LocalDate lastActiveDate,
    int dailyStreak,
    int bestDailyStreak,
    int bestLevelSeen,
    LocalDateTime ultimaSubidaNivel,
    int puntos
) {}
