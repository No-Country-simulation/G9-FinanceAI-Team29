package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;

/** Body de POST /api/push-unsubscribe. */
public record PushUnsubscribeRequest(
    @NotBlank String endpoint
) {}
