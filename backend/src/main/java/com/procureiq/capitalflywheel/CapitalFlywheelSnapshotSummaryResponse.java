package com.procureiq.capitalflywheel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalFlywheelSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

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

        int diminishingReturnLineageCount,

        String capturedByName,
        Instant capturedAt
) {
}
