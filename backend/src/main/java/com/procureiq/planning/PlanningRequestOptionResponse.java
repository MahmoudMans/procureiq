package com.procureiq.planning;

import java.math.BigDecimal;
import java.util.UUID;

public record PlanningRequestOptionResponse(
        UUID id,
        String requestNumber,
        String title,
        UUID departmentId,
        String departmentName,
        String currency,
        String status,
        BigDecimal estimatedTotal
) {
}
