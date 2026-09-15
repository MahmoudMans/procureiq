package com.procureiq.strategicvalue;

import java.math.BigDecimal;

public record StrategicValueSummaryResponse(
        int candidateCount,
        int caseCount,
        int verifiedCaseCount,
        int strongCaseCount,
        int healthyCaseCount,
        int watchCaseCount,
        int atRiskCaseCount,
        BigDecimal totalInvestmentAmount,
        BigDecimal totalAnnualOperatingCostAmount,
        BigDecimal totalBaselineHorizonValueAmount,
        BigDecimal totalDurableAnnualValueAmount,
        BigDecimal totalDurableHorizonValueAmount,
        BigDecimal totalDecayedValueAmount,
        BigDecimal totalCostAmount,
        BigDecimal totalNetValueAmount,
        BigDecimal totalValueAtRiskAmount,
        BigDecimal portfolioRoiPct,
        BigDecimal portfolioPaybackMonths,
        StrategicValueHealth portfolioHealth
) {
}
