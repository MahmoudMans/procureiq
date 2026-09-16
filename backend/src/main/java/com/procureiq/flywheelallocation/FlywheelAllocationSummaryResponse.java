package com.procureiq.flywheelallocation;

import java.math.BigDecimal;

public record FlywheelAllocationSummaryResponse(
        int eligibleStrategyCount,
        int mandateCount,
        int draftMandateCount,
        int reviewMandateCount,
        int authorizedMandateCount,
        int closedMandateCount,

        BigDecimal authorizedAllocationAmount
) {
}
