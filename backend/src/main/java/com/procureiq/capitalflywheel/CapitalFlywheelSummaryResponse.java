package com.procureiq.capitalflywheel;

import java.math.BigDecimal;

public record CapitalFlywheelSummaryResponse(
        int candidateCount,
        int lineageCount,

        int reviewPendingLineageCount,
        int approvedNextCycleLineageCount,
        int stoppedLineageCount,

        int totalCycleCount,

        BigDecimal totalOriginalCapitalAmount,
        BigDecimal totalCumulativeProjectedNetValueAmount,
        BigDecimal totalCompoundingValueAmount,
        BigDecimal totalDecayedValueAmount,

        BigDecimal averageCumulativeValueMultiple,
        BigDecimal averageLatestMarginalValueMultiple,

        int diminishingReturnLineageCount
) {
}
