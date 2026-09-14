package com.procureiq.portfoliooptimization;

import java.math.BigDecimal;

public record PortfolioOptimizationRunResponse(
        int candidateCount,
        int selectedCount,
        int excludedCount,
        BigDecimal selectedBudget,
        BigDecimal selectedTargetSavings,
        BigDecimal averageRiskScore,
        boolean minimumTargetMet
) {
}
