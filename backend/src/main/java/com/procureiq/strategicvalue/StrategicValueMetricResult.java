package com.procureiq.strategicvalue;

import java.math.BigDecimal;

public record StrategicValueMetricResult(
        BigDecimal persistencePct,
        BigDecimal baselineHorizonValueAmount,
        BigDecimal durableAnnualValueAmount,
        BigDecimal durableHorizonValueAmount,
        BigDecimal decayedValueAmount,
        BigDecimal operatingCostHorizonAmount,
        BigDecimal totalCostAmount,
        BigDecimal netValueAmount,
        BigDecimal roiPct,
        BigDecimal paybackMonths,
        BigDecimal valueAtRiskAmount,
        StrategicValueHealth health
) {
}
