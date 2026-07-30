package com.financeai.dto;
import java.math.BigDecimal;
public record GoalSummaryResponse(String usuarioId, BigDecimal saldoTotal, BigDecimal totalReservado,
 BigDecimal saldoDisponible, long metasActivas, long metasCompletadas, BigDecimal porcentajeReservado) {}
