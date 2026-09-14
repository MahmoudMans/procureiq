package com.procureiq.risk;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RiskMitigationActionResponse(
        UUID id,
        String title,
        String description,
        MitigationActionStatus status,
        LocalDate dueDate,
        boolean overdue,
        UUID ownerUserId,
        String ownerName,
        Instant completedAt,
        String completedByName,
        Instant createdAt,
        Instant updatedAt
) {
}
