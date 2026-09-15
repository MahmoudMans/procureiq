package com.procureiq.reinvestmentperformance;

import java.math.BigDecimal;

public record ReinvestmentPerformanceMetricResult(
        BigDecimal redeployedCapitalAmount,
        BigDecimal operatingCostHorizonAmount,
        BigDecimal totalCostAmount,
        BigDecimal expectedHorizonValueAmount,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedNetValueAmount,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal valueVarianceAmount,
        BigDecimal realizationPct,
        ReinvestmentPerformanceHealth health
) {
}
