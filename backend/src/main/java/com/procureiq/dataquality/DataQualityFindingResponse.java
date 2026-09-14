package com.procureiq.dataquality;

import java.time.Instant;
import java.util.UUID;

public record DataQualityFindingResponse(
        UUID id,
        String findingKey,

        long ruleId,
        String ruleCode,
        DataQualityDomain domain,
        String ruleTitle,
        DataQualitySeverity severity,

        String entityType,
        UUID entityId,
        UUID relatedEntityId,
        String entityReference,

        String details,

        DataQualityFindingStatus status,

        long openRemediationTasks,
        long overdueRemediationTasks,

        Instant detectedAt,
        Instant lastSeenAt,

        String resolutionNote,
        Instant resolvedAt,
        String resolvedByName,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
