package com.procureiq.capitalflywheel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalFlywheelLineageResponse(
        UUID id,
        String lineageNumber,

        UUID rootPersistenceCaseId,
        String rootPersistenceCaseNumber,

        UUID rootTargetValueCaseId,
        String rootTargetValueCaseNumber,
        String rootTargetInitiativeTitle,

        BigDecimal originalCapitalAmount,

        String currency,
        int rootFiscalYear,

        int maximumCycleCount,

        BigDecimal minimumMarginalValueMultiple,
        BigDecimal minimumCycleEfficiencyRetentionPct,
        BigDecimal diminishingReturnTolerancePct,

        UUID lineageOwnerUserId,
        String lineageOwnerName,
        String lineageObjective,

        CapitalFlywheelStatus status,

        int cycleCount,

        BigDecimal cumulativeProjectedNetValueAmount,
        BigDecimal cumulativeCompoundingValueAmount,
        BigDecimal cumulativeDecayedValueAmount,

        BigDecimal cumulativeValueMultiple,
        BigDecimal latestMarginalValueMultiple,
        BigDecimal latestMarginalNetValueRetentionPct,

        boolean diminishingReturns,

        CapitalFlywheelHealth flywheelHealth,
        CapitalFlywheelRecommendation recommendation,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
