package com.procureiq.continuousimprovement;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ImprovementActionResponse(
        UUID id,
        UUID initiativeId,
        String title,
        String description,
        UUID ownerUserId,
        String ownerName,
        ImprovementActionStatus status,
        LocalDate dueDate,
        boolean overdue,
        String completionNote,
        Instant startedAt,
        Instant completedAt,
        Instant cancelledAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
