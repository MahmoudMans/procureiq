package com.procureiq.strategicvalue;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StrategicValueReviewSummaryResponse(
        UUID id,
        String reviewNumber,
        int caseCount,
        int verifiedCaseCount,
        int atRiskCaseCount,
        int watchCaseCount,
        int strongCaseCount,
        BigDecimal totalInvestmentAmount,
        BigDecimal totalOperatingCostAmount,
        BigDecimal totalBaselineHorizonValueAmount,
        BigDecimal totalDurableHorizonValueAmount,
        BigDecimal totalDecayedValueAmount,
        BigDecimal totalCostAmount,
        BigDecimal totalNetValueAmount,
        BigDecimal portfolioRoiPct,
        BigDecimal portfolioPaybackMonths,
        StrategicValueHealth portfolioHealth,
        String capturedByName,
        Instant capturedAt
) {
}
