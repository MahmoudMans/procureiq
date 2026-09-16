package com.procureiq.flywheelcontinuationoutcome;

import java.util.List;

public record FlywheelContinuationOutcomeSummaryResponse(
        long totalCases,
        long draftCases,
        long inReviewCases,
        long verifiedCases,
        long closedCases,
        long furtherGovernanceRequiredCases,
        List<FlywheelContinuationOutcomeCurrencyTotal> remainingResidualByCurrency
) {
}
