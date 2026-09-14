package com.procureiq.planning;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProcurementPlanResponse(
        UUID id,
        String planNumber,
        String name,
        int fiscalYear,
        String currency,
        ProcurementPlanStatus status,
        UUID ownerUserId,
        String ownerName,
        String notes,
        long totalItems,
        long convertedItems,
        long completedItems,
        BigDecimal plannedValue,
        BigDecimal linkedActualValue,
        BigDecimal variance,
        BigDecimal conversionRate,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
