package com.procureiq.portfoliooptimization;

import java.util.List;

public record PortfolioOptimizationDashboardResponse(
        PortfolioOptimizationSummaryResponse summary,
        List<PortfolioScenarioSummaryResponse> scenarios
) {
}
