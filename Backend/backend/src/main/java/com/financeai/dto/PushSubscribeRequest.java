package com.financeai.dto;

import jakarta.validation.constraints.NotBlank;

/** Body de POST /api/push-subscribe. Coincide con el PushSubscription del navegador. */
public record PushSubscribeRequest(
    @NotBlank String endpoint,
    Keys keys
) {
    public record Keys(String p256dh, String auth) {}
}
