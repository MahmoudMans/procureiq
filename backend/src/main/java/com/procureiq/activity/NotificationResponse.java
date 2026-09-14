package com.procureiq.activity;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        long id,
        String notificationType,
        String severity,
        String title,
        String message,
        String entityType,
        UUID entityId,
        String href,
        boolean read,
        Instant readAt,
        Instant createdAt
) {
}
