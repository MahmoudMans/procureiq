package com.procureiq.processmining;

import java.time.Instant;
import java.util.UUID;

public record ProcessDeviationResponse(
        ProcessDeviationType deviationType,
        ProcessEntityType entityType,
        UUID entityId,
        String entityReference,
        String status,
        String details,
        Instant detectedAt
) {
}
