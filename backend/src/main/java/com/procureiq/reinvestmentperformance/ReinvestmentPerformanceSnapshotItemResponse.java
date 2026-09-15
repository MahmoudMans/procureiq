package com.procureiq.reinvestmentperformance;

import java.math.BigDecimal;
import java.util.UUID;

public record ReinvestmentPerformanceSnapshotItemResponse(
        UUID performanceCaseId,
        String performanceCaseNumber,
        String redeploymentNumber,
        String targetValueCaseNumber,
        String targetInitiativeTitle,
        String currency,

        ReinvestmentPerformanceStatus caseStatus,
        boolean assessed,

        BigDecimal redeployedCapitalAmount,
        BigDecimal expectedHorizonValueAmount,
        BigDecimal validatedRealizedAnnualizedValueAmount,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedNetValueAmount,

        BigDecimal baselineTargetRoiPct,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal valueVarianceAmount,
        BigDecimal realizationPct,

        ReinvestmentPerformanceHealth health
) {
}
