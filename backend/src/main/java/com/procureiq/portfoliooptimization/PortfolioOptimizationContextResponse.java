package com.procureiq.portfoliooptimization;

import java.util.List;

public record PortfolioOptimizationContextResponse(
        List<PortfolioUserOptionResponse> users
) {
}
