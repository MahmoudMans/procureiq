package com.procureiq.reinvestmentperformance;

import java.math.BigDecimal;

public record ReinvestmentPerformanceSummaryResponse(
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
        BigDecimal averageRealizationPct,

        BigDecimal totalRedeployedCapitalAmount,
        BigDecimal totalRealizedNetValueAmount
) {
}
