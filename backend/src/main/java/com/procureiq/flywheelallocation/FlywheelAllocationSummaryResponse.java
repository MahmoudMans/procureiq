package com.procureiq.flywheelallocation;

import com.procureiq.common.money.CurrencyTotal;
import java.util.List;

public record FlywheelAllocationSummaryResponse(
        int eligibleStrategyCount,
        int mandateCount,
        int draftMandateCount,
        int reviewMandateCount,
        int authorizedMandateCount,
        int closedMandateCount,
        List<CurrencyTotal> authorizedAllocationByCurrency
) {
}
