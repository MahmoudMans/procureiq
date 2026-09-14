package com.procureiq.planning;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ProcurementPlanItemResponse(
        UUID id,
        UUID planId,
        String title,
        String description,
        UUID departmentId,
        String departmentName,
        String category,
        BigDecimal plannedValue,
        LocalDate targetSourcingDate,
        ProcurementPlanPriority priority,
        ProcurementPlanItemStatus status,

        UUID linkedPurchaseRequestId,
        String linkedRequestNumber,
        String linkedRequestStatus,
        BigDecimal linkedRequestValue,

        BigDecimal variance,
        boolean overdue,
        String notes,
        Instant convertedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
