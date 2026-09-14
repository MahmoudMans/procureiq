package com.procureiq.portfoliooptimization;

import java.math.BigDecimal;

public record PortfolioOptimizationConstraints(
        BigDecimal budgetLimit,
        int maxInitiatives,
        BigDecimal maxAverageRiskScore,
        BigDecimal minTotalTargetSavings,
        boolean allowCriticalPriority
) {
}
