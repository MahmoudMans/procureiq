package com.procureiq.anomaly;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AnomalyFindingResponse(
        UUID id,
        String findingKey,

        long ruleId,
        String ruleCode,
        AnomalySignalType signalType,
        String ruleTitle,
        AnomalySeverity severity,

        String entityType,
        UUID entityId,
        UUID relatedEntityId,
        String entityReference,

        String currency,
        BigDecimal exposureValue,
        BigDecimal metricValue,
        BigDecimal anomalyScore,

        String details,

        AnomalyFindingStatus status,

        long activeInvestigations,
        long overdueInvestigations,

        Instant detectedAt,
        Instant lastSeenAt,

        String dispositionNote,
        Instant disposedAt,
        String disposedByName,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
