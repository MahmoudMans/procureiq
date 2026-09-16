package com.procureiq.flywheelcontinuation;

import java.util.List;

public record FlywheelResidualContinuationSummaryResponse(
        long totalCases,
        long draftCases,
        long inReviewCases,
        long approvedCases,
        long closedCases,
        List<FlywheelResidualContinuationCurrencyTotal> governedResidualByCurrency
) {
}
