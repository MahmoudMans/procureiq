package com.procureiq.investmentperformance;

import java.math.BigDecimal;

public record InvestmentPerformanceSummaryResponse(
        int candidateCount,
        int caseCount,
        int assessedCaseCount,
        int outperformingCaseCount,
        int onTrackCaseCount,
        int watchCaseCount,
        int underperformingCaseCount,
        int remediationCaseCount,
        int verifiedCaseCount,
        BigDecimal averageRealizedRoiPct,
        BigDecimal averageRoiVariancePct,
        BigDecimal averageFundingVariancePct,
        BigDecimal averageCapitalEfficiencyMultiple
) {
}
