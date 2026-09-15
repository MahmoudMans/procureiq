package com.procureiq.reinvestmentperformance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ReinvestmentPerformanceSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        int caseCount,
        int assessedCaseCount,
        int outperformingCaseCount,
        int onTrackCaseCount,
        int watchCaseCount,
        int underperformingCaseCount,
        int remediationCaseCount,

        BigDecimal averageRealizedRoiPct,
        BigDecimal averageRoiVariancePct,
        BigDecimal averageRealizationPct,

        BigDecimal totalRedeployedCapitalAmount,
        BigDecimal totalRealizedNetValueAmount,

        String capturedByName,
        Instant capturedAt
) {
}
