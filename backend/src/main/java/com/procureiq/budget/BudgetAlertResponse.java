package com.procureiq.budget;

import java.math.BigDecimal;
import java.util.UUID;

public record BudgetAlertResponse(
        UUID allocationId,
        BudgetScopeType scopeType,
        String scopeLabel,
        String currency,
        BudgetAlertLevel alertLevel,
        BigDecimal forecastUtilizationPercent,
        BigDecimal remainingForecast,
        boolean hardLimit,
        String message
) {
}
