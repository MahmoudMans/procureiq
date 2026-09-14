package com.procureiq.portfoliooptimization;

import java.math.BigDecimal;
import java.util.List;

public record PortfolioOptimizationResult(
        int candidateCount,
        int selectedCount,
        BigDecimal selectedBudget,
        BigDecimal selectedTargetSavings,
        BigDecimal averageRiskScore,
        boolean minimumTargetMet,
        List<PortfolioOptimizationSelection> selections
) {
}
