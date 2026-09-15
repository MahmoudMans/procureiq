package com.procureiq.capitalflywheel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalFlywheelReviewResponse(
        UUID id,
        UUID lineageId,
        UUID latestCycleId,

        int cycleCount,

        CapitalFlywheelRecommendation recommendation,
        CapitalFlywheelReviewDecision decision,

        boolean overrideFlag,
        boolean diminishingReturns,

        BigDecimal cumulativeProjectedNetValueAmount,
        BigDecimal cumulativeCompoundingValueAmount,
        BigDecimal cumulativeDecayedValueAmount,

        BigDecimal cumulativeValueMultiple,
        BigDecimal latestMarginalValueMultiple,
        BigDecimal latestMarginalNetValueRetentionPct,

        BigDecimal latestCycleEfficiencyRetentionPct,
        BigDecimal latestCycleValuePersistencePct,
        BigDecimal latestCycleProjectedRoiPct,

        CapitalFlywheelHealth flywheelHealth,

        String decisionNote,
        String reviewedByName,
        Instant reviewedAt
) {
}
