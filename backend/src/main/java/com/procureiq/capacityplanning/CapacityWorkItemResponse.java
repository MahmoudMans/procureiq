package com.procureiq.capacityplanning;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CapacityWorkItemResponse(
        UUID estimateId,
        CapacitySourceType sourceType,
        UUID sourceEntityId,
        String sourceReference,
        String sourceTitle,
        String sourceStatus,
        LocalDate dueDate,
        BigDecimal strategicValue,
        BigDecimal riskExposure,
        BigDecimal riskScore,
        BigDecimal estimatedEffortHours,
        BigDecimal allocationPct,
        BigDecimal assignedEffortHours,
        BigDecimal unassignedEffortHours,
        int assignmentCount,
        CapacityWorkStatus planningStatus,
        boolean deadlinePressure,
        List<CapacityAssignmentResponse> assignments
) {
}
