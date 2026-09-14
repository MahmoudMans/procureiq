package com.procureiq.budget;

import java.math.BigDecimal;

public record BudgetSummaryResponse(
        int fiscalYear,
        String currency,
        long activeAllocations,
        BigDecimal totalBudget,
        BigDecimal committedSpend,
        BigDecimal openRequestExposure,
        BigDecimal forecastExposure,
        BigDecimal remainingForecast,
        BigDecimal utilizationPercent,
        BigDecimal forecastUtilizationPercent,
        long warningAllocations,
        long exceededAllocations
) {
}
