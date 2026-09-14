package com.procureiq.governancereview;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record GovernanceActionResponse(
        UUID id,
        String actionNumber,
        UUID reviewId,
        UUID decisionId,
        String title,
        String description,
        UUID ownerUserId,
        String ownerName,
        GovernanceActionPriority priority,
        LocalDate dueDate,
        GovernanceActionStatus status,
        boolean overdue,
        String completionNote,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
