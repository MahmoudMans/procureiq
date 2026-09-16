package com.procureiq.flywheelcontinuationrollover;

import java.util.List;

public record FlywheelContinuationRolloverSummaryResponse(
        long totalCases,
        long draftCases,
        long inReviewCases,
        long approvedCases,
        long closedCases,
        List<FlywheelContinuationRolloverCurrencyTotal> governedResidualByCurrency
) {
}
