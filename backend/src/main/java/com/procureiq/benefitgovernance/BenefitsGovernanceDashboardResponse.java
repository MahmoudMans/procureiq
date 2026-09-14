package com.procureiq.benefitgovernance;

import java.util.List;

public record BenefitsGovernanceDashboardResponse(
        BenefitsGovernanceSummaryResponse summary,
        List<ExecutionPortfolioSummaryResponse> portfolios
) {
}
