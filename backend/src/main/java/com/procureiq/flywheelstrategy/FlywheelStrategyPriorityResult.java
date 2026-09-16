package com.procureiq.flywheelstrategy;

import java.math.BigDecimal;

public record FlywheelStrategyPriorityResult(
        BigDecimal priorityScore,
        FlywheelStrategyAdvisory advisoryRecommendation
) {
}
