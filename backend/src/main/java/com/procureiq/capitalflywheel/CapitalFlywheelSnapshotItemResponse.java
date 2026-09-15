package com.procureiq.capitalflywheel;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalFlywheelSnapshotItemResponse(
        UUID lineageId,
        String lineageNumber,
        String rootTargetInitiativeTitle,
        String currency,

        CapitalFlywheelStatus lineageStatus,

        int cycleCount,

        BigDecimal originalCapitalAmount,

        BigDecimal cumulativeProjectedNetValueAmount,
        BigDecimal cumulativeCompoundingValueAmount,
        BigDecimal cumulativeDecayedValueAmount,

        BigDecimal cumulativeValueMultiple,
        BigDecimal latestMarginalValueMultiple,
        BigDecimal latestMarginalNetValueRetentionPct,

        boolean diminishingReturns,

        CapitalFlywheelHealth flywheelHealth,
        CapitalFlywheelRecommendation recommendation
) {
}
