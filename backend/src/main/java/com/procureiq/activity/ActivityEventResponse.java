package com.procureiq.activity;

import java.time.Instant;
import java.util.UUID;

public record ActivityEventResponse(
        long id,
        String entityType,
        UUID entityId,
        String action,
        String status,
        UUID actorUserId,
        String actorName,
        String summary,
        String href,
        Instant occurredAt
) {
}
