package com.procureiq.supplierresilience;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ResilienceActionResponse(
        UUID id,
        UUID profileId,
        ResilienceActionType actionType,
        String title,
        String description,
        UUID ownerUserId,
        String ownerName,
        LocalDate dueDate,
        ResilienceActionStatus status,
        boolean overdue,
        String completionNote,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
