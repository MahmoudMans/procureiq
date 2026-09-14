package com.procureiq.executive;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExecutiveWarningResponse(
        String warningKey,
        long ruleId,
        String ruleCode,

        ExecutiveSignalType signalType,
        ExecutiveSignalNature nature,
        ExecutiveWarningSeverity severity,

        String title,
        String details,
        String recommendation,

        String referenceType,
        UUID referenceId,
        String referenceLabel,

        String currency,
        BigDecimal exposureValue,
        BigDecimal metricValue,

        Instant dueAt,

        BigDecimal priorityScore,

        boolean acknowledged,
        Instant acknowledgedAt,
        String acknowledgedByName,
        String acknowledgementNote
) {
}
