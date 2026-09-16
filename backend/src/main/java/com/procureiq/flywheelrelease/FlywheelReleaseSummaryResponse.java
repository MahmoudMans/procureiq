package com.procureiq.flywheelrelease;

import java.math.BigDecimal;

public record FlywheelReleaseSummaryResponse(
        int eligibleMandateCount,

        int batchCount,
        int draftBatchCount,
        int executionBatchCount,
        int executedBatchCount,
        int closedBatchCount,

        BigDecimal cumulativeReleasedAmount
) {
}
