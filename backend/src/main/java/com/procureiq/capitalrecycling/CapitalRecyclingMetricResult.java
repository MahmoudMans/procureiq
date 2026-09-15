package com.procureiq.capitalrecycling;

import java.math.BigDecimal;

public record CapitalRecyclingMetricResult(
        BigDecimal recyclableCapitalAmount,
        BigDecimal approvedReinvestmentAmount,
        BigDecimal pendingReinvestmentAmount,
        BigDecimal availableCapitalAmount,
        BigDecimal utilizationPct
) {
}
