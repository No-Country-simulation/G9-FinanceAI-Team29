package com.financeai.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
public record GoalAmountRequest(@NotNull @DecimalMin(value = "0.01") BigDecimal monto) {}
