package com.procureiq.capitalflywheel;

import java.math.BigDecimal;

public record CapitalFlywheelMetricResult(
        int cycleCount,

        BigDecimal cumulativeProjectedNetValueAmount,
        BigDecimal cumulativeCompoundingValueAmount,
        BigDecimal cumulativeDecayedValueAmount,

        BigDecimal cumulativeValueMultiple,
        BigDecimal latestMarginalValueMultiple,
        BigDecimal latestMarginalNetValueRetentionPct,

        BigDecimal latestCycleEfficiencyRetentionPct,
        BigDecimal latestCycleValuePersistencePct,
        BigDecimal latestCycleProjectedRoiPct,

        boolean diminishingReturns,

        CapitalFlywheelHealth health,
        CapitalFlywheelRecommendation recommendation
) {
}
