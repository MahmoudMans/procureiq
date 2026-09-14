package com.procureiq.budget;

import java.math.BigDecimal;
import java.util.UUID;

public record BudgetRequestOptionResponse(
        UUID id,
        String requestNumber,
        String title,
        String departmentName,
        String status,
        String currency,
        BigDecimal estimatedTotal
) {
}
