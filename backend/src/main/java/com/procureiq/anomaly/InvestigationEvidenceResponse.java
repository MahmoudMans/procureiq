package com.procureiq.anomaly;

import java.time.Instant;
import java.util.UUID;

public record InvestigationEvidenceResponse(
        UUID id,
        UUID investigationId,
        InvestigationEvidenceType evidenceType,
        String referenceText,
        UUID addedByUserId,
        String addedByName,
        Instant createdAt
) {
}
