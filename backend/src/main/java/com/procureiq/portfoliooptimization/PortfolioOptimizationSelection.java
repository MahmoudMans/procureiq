package com.procureiq.portfoliooptimization;

import java.math.BigDecimal;
import java.util.UUID;

public record PortfolioOptimizationSelection(
        UUID initiativeId,
        PortfolioScenarioDecision decision,
        Integer rankPosition,
        BigDecimal savingsEfficiencyPct,
        BigDecimal priorityScore,
        BigDecimal matrixUrgencyScore,
        BigDecimal utilityScore,
        String exclusionReason
) {
}
