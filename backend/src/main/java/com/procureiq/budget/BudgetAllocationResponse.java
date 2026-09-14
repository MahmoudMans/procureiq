package com.procureiq.budget;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BudgetAllocationResponse(
        UUID id,
        int fiscalYear,
        BudgetScopeType scopeType,
        UUID departmentId,
        String departmentName,
        String category,
        String scopeLabel,
        String currency,
        BigDecimal budgetAmount,
        BigDecimal warningThresholdPercent,
        boolean hardLimit,
        BudgetStatus status,
        UUID ownerUserId,
        String ownerName,
        String notes,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
