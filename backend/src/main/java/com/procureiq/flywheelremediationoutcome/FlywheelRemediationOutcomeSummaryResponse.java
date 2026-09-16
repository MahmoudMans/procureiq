package com.procureiq.flywheelremediationoutcome;

import java.util.List;

public record FlywheelRemediationOutcomeSummaryResponse(
        long totalCases,
        long draftCases,
        long inReviewCases,
        long verifiedCases,
        long closedCases,
        List<FlywheelRemediationOutcomeCurrencyTotal> remainingByCurrency
) {
}
