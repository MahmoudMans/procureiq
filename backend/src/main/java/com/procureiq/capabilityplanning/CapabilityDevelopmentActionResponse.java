package com.procureiq.capabilityplanning;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CapabilityDevelopmentActionResponse(
        UUID id,
        UUID userId,
        String userName,
        UUID skillId,
        String skillCode,
        String skillName,
        int fiscalYear,
        CapabilityActionType actionType,
        String title,
        String description,
        int targetProficiency,
        LocalDate dueDate,
        CapabilityActionStatus status,
        boolean overdue,
        String evidenceNote,
        Instant startedAt,
        Instant completedAt,
        Instant cancelledAt,
        Instant createdAt,
        long version
) {
}
