package com.procureiq.investmentperformance;

import java.math.BigDecimal;
import java.util.UUID;

public record InvestmentPerformanceSnapshotItemResponse(
        UUID performanceCaseId,
        String performanceCaseNumber,
        String fundingCommitmentNumber,
        String valueCaseNumber,
        String initiativeNumber,
        String initiativeTitle,
        String currency,
        InvestmentPerformanceCaseStatus caseStatus,
        boolean assessed,
        BigDecimal releasedCapitalAmount,
        BigDecimal baselineInvestmentCostAmount,
        BigDecimal baselineDurableHorizonValueAmount,
        BigDecimal validatedRealizedAnnualizedValueAmount,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedNetValueAmount,
        BigDecimal baselineRoiPct,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal fundingVarianceAmount,
        BigDecimal fundingVariancePct,
        BigDecimal capitalEfficiencyMultiple,
        BigDecimal valueVarianceAmount,
        InvestmentPerformanceHealth health
) {
}
