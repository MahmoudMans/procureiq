package com.procureiq.planning;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PlanningUpcomingDemandResponse(
        UUID itemId,
        UUID planId,
        String planNumber,
        String title,
        String departmentName,
        String category,
        ProcurementPlanPriority priority,
        ProcurementPlanItemStatus status,
        BigDecimal plannedValue,
        LocalDate targetSourcingDate,
        long daysUntilTarget
) {
}
