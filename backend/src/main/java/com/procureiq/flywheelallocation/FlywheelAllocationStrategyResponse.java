package com.procureiq.flywheelallocation;

import com.procureiq.flywheelstrategy.FlywheelStrategyPortfolioStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelAllocationStrategyResponse(
        UUID strategyPortfolioId,
        String strategyPortfolioNumber,
        String title,

        String currency,
        int fiscalYear,

        BigDecimal capitalCapacityAmount,
        BigDecimal prioritizedCapacityAmount,
        BigDecimal remainingCapacityAmount,
        BigDecimal capacityUtilizationPct,
        BigDecimal averagePriorityScore,

        int prioritizedItemCount,

        String strategyOwnerName,
        String strategicObjective,

        FlywheelStrategyPortfolioStatus status
) {
}
