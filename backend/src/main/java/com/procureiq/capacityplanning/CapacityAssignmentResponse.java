package com.procureiq.capacityplanning;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapacityAssignmentResponse(
        UUID id,
        UUID workEstimateId,
        UUID userId,
        String userName,
        String role,
        BigDecimal allocationPct,
        BigDecimal assignedEffortHours,
        String createdByName,
        Instant createdAt
) {
}
