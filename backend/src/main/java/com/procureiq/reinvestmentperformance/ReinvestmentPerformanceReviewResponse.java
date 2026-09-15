package com.procureiq.reinvestmentperformance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ReinvestmentPerformanceReviewResponse(
        UUID id,
        UUID performanceCaseId,
        UUID observationId,
        ReinvestmentPerformanceReviewDecision decision,
        ReinvestmentPerformanceHealth health,

        BigDecimal redeployedCapitalAmount,
        BigDecimal operatingCostHorizonAmount,
        BigDecimal totalCostAmount,
        BigDecimal expectedHorizonValueAmount,

        BigDecimal validatedRealizedAnnualizedValueAmount,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedNetValueAmount,

        BigDecimal baselineTargetRoiPct,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,

        BigDecimal valueVarianceAmount,
        BigDecimal realizationPct,

        String reviewNote,
        String reviewedByName,
        Instant reviewedAt
) {
}
