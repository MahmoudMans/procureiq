package com.procureiq.flywheelsettlement;

import com.procureiq.common.money.CurrencyTotal;

import java.util.List;

public record FlywheelSettlementSummaryResponse(
        int eligibleReleaseCount,

        int caseCount,
        int draftCaseCount,
        int reviewCaseCount,
        int reconciledCaseCount,
        int closedCaseCount,

        List<CurrencyTotal> reconciledSettledByCurrency,
        List<CurrencyTotal> reconciledVarianceByCurrency
) {
}
