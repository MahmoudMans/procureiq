package com.procureiq.flywheelallocation;

import java.math.BigDecimal;

public record FlywheelAllocationMetricResult(
        BigDecimal requestedAllocationAmount,
        BigDecimal remainingStrategyCapacityAmount,
        BigDecimal allocationUtilizationPct
) {
}
