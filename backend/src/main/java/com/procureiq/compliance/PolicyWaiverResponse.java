package com.procureiq.compliance;

import java.time.Instant;
import java.util.UUID;

public record PolicyWaiverResponse(
        UUID id,
        String waiverNumber,
        UUID violationId,
        String rationale,
        PolicyWaiverStatus status,
        UUID requestedByUserId,
        String requestedByName,
        Instant requestedAt,
        String decisionNote,
        String decidedByName,
        Instant decidedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
