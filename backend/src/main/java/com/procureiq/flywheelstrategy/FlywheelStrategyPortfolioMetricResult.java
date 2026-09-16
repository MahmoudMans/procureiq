package com.procureiq.flywheelstrategy;

import java.math.BigDecimal;

public record FlywheelStrategyPortfolioMetricResult(
        BigDecimal prioritizedCapacityAmount,
        BigDecimal remainingCapacityAmount,
        BigDecimal capacityUtilizationPct,
        BigDecimal averagePriorityScore
) {
}
