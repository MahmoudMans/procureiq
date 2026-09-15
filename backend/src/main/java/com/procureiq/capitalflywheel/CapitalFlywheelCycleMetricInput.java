package com.procureiq.capitalflywheel;

import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceHealth;

import java.math.BigDecimal;

public record CapitalFlywheelCycleMetricInput(
        BigDecimal projectedNetValueAmount,
        BigDecimal currentCapitalEfficiencyMultiple,
        BigDecimal valuePersistencePct,
        BigDecimal efficiencyRetentionPct,
        BigDecimal compoundingValueAmount,
        BigDecimal decayedValueAmount,
        BigDecimal projectedRoiPct,
        ReinvestmentPersistenceHealth persistenceHealth
) {
}
