package com.procureiq.flywheelremediation;

import java.util.List;

public record FlywheelResidualRemediationSummaryResponse(
        long totalPlans,
        long draftPlans,
        long inReviewPlans,
        long approvedPlans,
        long closedPlans,
        List<FlywheelResidualRemediationCurrencyTotal> residualByCurrency
) {
}
