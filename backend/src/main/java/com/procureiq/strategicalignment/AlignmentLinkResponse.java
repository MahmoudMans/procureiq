package com.procureiq.strategicalignment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AlignmentLinkResponse(
        UUID id,
        UUID objectiveId,
        String objectiveNumber,
        String objectiveTitle,
        AlignmentSourceType sourceType,
        UUID sourceEntityId,
        String sourceReference,
        String sourceTitle,
        AlignmentRole alignmentRole,
        BigDecimal allocationPct,
        String rationale,
        String createdByName,
        Instant createdAt
) {
}
