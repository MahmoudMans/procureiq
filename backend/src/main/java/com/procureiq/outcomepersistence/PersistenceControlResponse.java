package com.procureiq.outcomepersistence;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PersistenceControlResponse(
        UUID id,
        UUID planId,
        String title,
        String description,
        UUID ownerUserId,
        String ownerName,
        LocalDate dueDate,
        PersistenceControlStatus status,
        boolean overdue,
        String completionEvidence,
        Instant startedAt,
        Instant completedAt,
        Instant cancelledAt,
        Instant createdAt,
        long version
) {
}
