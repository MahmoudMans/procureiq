package com.procureiq.benefitgovernance;

import java.util.List;

public record ExecutionPortfolioDetailResponse(
        ExecutionPortfolioSummaryResponse portfolio,
        String notes,
        List<BenefitItemResponse> benefitItems,
        List<BenefitAssumptionResponse> assumptions,
        List<BenefitLeakageResponse> leakage
) {
}
