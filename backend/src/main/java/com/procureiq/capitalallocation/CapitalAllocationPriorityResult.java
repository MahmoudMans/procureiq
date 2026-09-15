package com.procureiq.capitalallocation;

import java.math.BigDecimal;

public record CapitalAllocationPriorityResult(
        BigDecimal roiScore,
        BigDecimal persistenceScore,
        BigDecimal paybackScore,
        BigDecimal healthScore,
        BigDecimal priorityScore,
        CapitalAllocationDecision recommendation
) {
}
