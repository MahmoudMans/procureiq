package com.procureiq.investmentperformance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InvestmentPerformanceSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        int caseCount,
        int assessedCaseCount,
        int outperformingCaseCount,
        int onTrackCaseCount,
        int watchCaseCount,
        int underperformingCaseCount,
        BigDecimal averageRealizedRoiPct,
        BigDecimal averageRoiVariancePct,
        BigDecimal averageFundingVariancePct,
        BigDecimal averageCapitalEfficiencyMultiple,
        String capturedByName,
        Instant capturedAt
) {
}
