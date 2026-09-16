package com.procureiq.flywheelrelease;

import com.procureiq.common.money.CurrencyTotal;
import java.util.List;

public record FlywheelReleaseSummaryResponse(
        int eligibleMandateCount,
        int batchCount,
        int draftBatchCount,
        int executionBatchCount,
        int executedBatchCount,
        int closedBatchCount,
        int cancelledBatchCount,
        List<CurrencyTotal> cumulativeReleasedByCurrency
) {
}
