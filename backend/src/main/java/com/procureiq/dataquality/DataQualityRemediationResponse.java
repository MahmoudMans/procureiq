package com.procureiq.dataquality;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record DataQualityRemediationResponse(
        UUID id,
        UUID findingId,
        String title,
        UUID ownerUserId,
        String ownerName,
        LocalDate dueDate,
        DataQualityRemediationStatus status,
        boolean overdue,
        String completionNote,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
