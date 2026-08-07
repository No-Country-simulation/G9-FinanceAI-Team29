package com.financeai.dto;

import java.time.LocalDateTime;

public record RetoProgresoResponse(
    String retoId, String semanaIso, boolean completado, String progreso, LocalDateTime actualizadoAt
) {}
