package com.procureiq.budget;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseRequestBudgetCheckResponse(
        UUID purchaseRequestId,
        String requestNumber,
        UUID departmentId,
        String departmentName,
        String currency,
        BigDecimal requestAmount,

        boolean budgetConfigured,
        UUID allocationId,
        BigDecimal budgetAmount,
        BigDecimal currentForecastExposure,
        BigDecimal projectedForecastExposure,
        BigDecimal projectedUtilizationPercent,
        BigDecimal remainingAfterRequest,
        BigDecimal warningThresholdPercent,
        boolean hardLimit,
        boolean blocked,
        BudgetAlertLevel alertLevel,
        String message
) {
}
