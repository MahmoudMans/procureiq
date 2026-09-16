package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelHealth;
import com.procureiq.capitalflywheel.CapitalFlywheelRecommendation;

import java.math.BigDecimal;

public record FlywheelStrategyPriorityInput(
        BigDecimal cumulativeValueMultiple,
        BigDecimal latestMarginalValueMultiple,
        BigDecimal latestMarginalNetValueRetentionPct,
        boolean diminishingReturns,
        CapitalFlywheelHealth flywheelHealth,
        CapitalFlywheelRecommendation step66Recommendation
) {
}
