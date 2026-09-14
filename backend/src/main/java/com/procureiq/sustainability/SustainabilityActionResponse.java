package com.procureiq.sustainability;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SustainabilityActionResponse(
        UUID id,
        UUID assessmentId,
        SustainabilityActionType actionType,
        String title,
        String description,
        UUID ownerUserId,
        String ownerName,
        LocalDate dueDate,
        SustainabilityActionStatus status,
        boolean overdue,
        String completionNote,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
