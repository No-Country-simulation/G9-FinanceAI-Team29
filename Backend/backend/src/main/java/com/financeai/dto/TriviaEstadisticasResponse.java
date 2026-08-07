package com.financeai.dto;

import java.time.LocalDate;

public record TriviaEstadisticasResponse(
    int bestScore,
    int correctStreak,
    LocalDate lastPlayedDate,
    boolean canPlayToday
) {}
