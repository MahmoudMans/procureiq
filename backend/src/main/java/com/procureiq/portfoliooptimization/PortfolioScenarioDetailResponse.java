package com.procureiq.portfoliooptimization;

import java.util.List;

public record PortfolioScenarioDetailResponse(
        PortfolioScenarioSummaryResponse scenario,
        String notes,
        List<PortfolioScenarioItemResponse> items
) {
}
