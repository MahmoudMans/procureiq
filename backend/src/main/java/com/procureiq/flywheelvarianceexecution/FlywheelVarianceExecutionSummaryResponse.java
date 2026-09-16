package com.procureiq.flywheelvarianceexecution;

import com.procureiq.common.money.CurrencyTotal;

import java.util.List;

public record FlywheelVarianceExecutionSummaryResponse(
        int eligiblePlanCount,

        int caseCount,
        int draftCaseCount,
        int reviewCaseCount,
        int verifiedCaseCount,
        int closedCaseCount,

        List<CurrencyTotal> recoveredByCurrency,
        List<CurrencyTotal> writtenOffByCurrency,
        List<CurrencyTotal> completedInvestigationByCurrency,
        List<CurrencyTotal> openExposureByCurrency
) {
}
