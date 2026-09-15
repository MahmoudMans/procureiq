package com.procureiq.reinvestmentpersistence;

import java.math.BigDecimal;

public record ReinvestmentPersistenceMetricResult(
        BigDecimal baselineAnnualizedValueAmount,
        BigDecimal currentAnnualizedValueAmount,

        BigDecimal baselineHorizonValueAmount,
        BigDecimal currentProjectedHorizonValueAmount,

        BigDecimal baselineNetValueAmount,
        BigDecimal currentProjectedNetValueAmount,

        BigDecimal baselineRoiPct,
        BigDecimal currentProjectedRoiPct,
        BigDecimal roiVariancePct,

        BigDecimal valuePersistencePct,
        BigDecimal compoundingValueAmount,
        BigDecimal decayedValueAmount,

        BigDecimal baselineCapitalEfficiencyMultiple,
        BigDecimal currentCapitalEfficiencyMultiple,
        BigDecimal capitalEfficiencyDelta,
        BigDecimal efficiencyRetentionPct,

        ReinvestmentPersistenceHealth health
) {
}
