package com.procureiq.portfoliooptimization;

import java.math.BigDecimal;
import java.util.UUID;

public record PortfolioOptimizationSummaryResponse(
        String currency,
        long scenarios,
        long evaluatedScenarios,
        long approvedScenarios,
        BigDecimal approvedPortfolioBudget,
        BigDecimal approvedPortfolioSavings,
        UUID recommendedScenarioId
) {
}
