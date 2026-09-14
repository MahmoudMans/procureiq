package com.procureiq.budget;

import java.math.BigDecimal;
import java.util.UUID;

public record BudgetUsageResponse(
        UUID allocationId,
        int fiscalYear,
        BudgetScopeType scopeType,
        String scopeLabel,
        String currency,
        BigDecimal budgetAmount,
        BigDecimal committedSpend,
        BigDecimal openRequestExposure,
        BigDecimal forecastExposure,
        BigDecimal remainingCommitted,
        BigDecimal remainingForecast,
        BigDecimal utilizationPercent,
        BigDecimal forecastUtilizationPercent,
        BigDecimal warningThresholdPercent,
        boolean hardLimit,
        BudgetAlertLevel alertLevel
) {
}
