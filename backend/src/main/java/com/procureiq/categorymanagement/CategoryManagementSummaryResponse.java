package com.procureiq.categorymanagement;

import java.math.BigDecimal;

public record CategoryManagementSummaryResponse(
        String currency,
        long categories,
        long activeStrategies,
        long activeInitiatives,
        long highRiskCategories,
        BigDecimal totalSpend,
        BigDecimal modeledOpportunity,
        BigDecimal strategyTargetSavings,
        BigDecimal realizedSavings
) {
}
