package com.procureiq.compliance;

import java.time.Instant;
import java.util.UUID;

public record PolicyEvidenceResponse(
        UUID id,
        UUID violationId,
        PolicyEvidenceType evidenceType,
        String content,
        UUID addedByUserId,
        String addedByName,
        Instant createdAt
) {
}
