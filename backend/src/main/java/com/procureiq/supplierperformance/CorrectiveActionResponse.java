package com.procureiq.supplierperformance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CorrectiveActionResponse(
        UUID id,
        UUID reviewId,
        String title,
        String description,
        UUID ownerUserId,
        String ownerName,
        LocalDate dueDate,
        CorrectiveActionStatus status,
        boolean overdue,
        Instant completedAt,
        String completionNote,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
