package com.procureiq.investmentperformance;

import java.math.BigDecimal;

public record InvestmentPerformanceMetricResult(
        BigDecimal releasedCapitalAmount,
        BigDecimal fundingVarianceAmount,
        BigDecimal fundingVariancePct,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedOperatingCostHorizonAmount,
        BigDecimal realizedTotalCostAmount,
        BigDecimal realizedNetValueAmount,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal capitalEfficiencyMultiple,
        BigDecimal valueVarianceAmount,
        InvestmentPerformanceHealth health
) {
}
