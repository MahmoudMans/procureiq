package com.procureiq.benefitgovernance;

import java.math.BigDecimal;

public record BenefitsGovernanceSummaryResponse(
        String currency,
        long portfolios,
        long activePortfolios,
        long validationPendingItems,
        long portfoliosWithLeakage,
        BigDecimal baselineTargetSavings,
        BigDecimal forecastSavings,
        BigDecimal operationalReportedSavings,
        BigDecimal validatedSavings,
        BigDecimal activeLeakageAmount,
        BigDecimal atRiskAmount,
        BigDecimal forecastCoveragePct,
        BigDecimal validationCoveragePct
) {
}
