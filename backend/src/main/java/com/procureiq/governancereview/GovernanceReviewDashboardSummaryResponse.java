package com.procureiq.governancereview;

import java.math.BigDecimal;

public record GovernanceReviewDashboardSummaryResponse(
        String currency,
        long reviews,
        long activeReviews,
        long openDecisions,
        long openActions,
        long overdueActions,
        BigDecimal latestTargetSavings,
        BigDecimal latestValidatedSavings,
        BigDecimal latestAtRiskAmount,
        long latestCriticalSuppliers
) {
}
