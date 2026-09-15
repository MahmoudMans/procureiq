package com.procureiq.investmentperformance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InvestmentPerformanceDecisionResponse(
        UUID id,
        UUID performanceCaseId,
        UUID observationId,
        InvestmentPerformanceReviewDecision decision,
        InvestmentPerformanceHealth health,
        BigDecimal releasedCapitalAmount,
        BigDecimal validatedRealizedAnnualizedValueAmount,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedTotalCostAmount,
        BigDecimal realizedNetValueAmount,
        BigDecimal realizedRoiPct,
        BigDecimal baselineRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal fundingVarianceAmount,
        BigDecimal fundingVariancePct,
        BigDecimal capitalEfficiencyMultiple,
        BigDecimal valueVarianceAmount,
        String decisionNote,
        String decidedByName,
        Instant decidedAt
) {
}
