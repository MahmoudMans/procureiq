package com.procureiq.flywheelvariance;

import com.procureiq.common.money.CurrencyTotal;

import java.util.List;

public record FlywheelVarianceSummaryResponse(
        int eligibleSettlementCount,

        int planCount,
        int draftPlanCount,
        int reviewPlanCount,
        int approvedPlanCount,
        int closedPlanCount,

        List<CurrencyTotal> recoverByCurrency,
        List<CurrencyTotal> writeOffByCurrency,
        List<CurrencyTotal> investigationByCurrency
) {
}
