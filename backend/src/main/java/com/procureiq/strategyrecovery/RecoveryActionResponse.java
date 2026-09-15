package com.procureiq.strategyrecovery;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RecoveryActionResponse(
        UUID id,
        UUID recoveryCaseId,
        String title,
        String description,
        UUID ownerUserId,
        String ownerName,
        LocalDate dueDate,
        RecoveryActionStatus status,
        boolean overdue,
        String completionEvidence,
        Instant startedAt,
        Instant completedAt,
        Instant cancelledAt,
        Instant createdAt,
        long version
) {
}
