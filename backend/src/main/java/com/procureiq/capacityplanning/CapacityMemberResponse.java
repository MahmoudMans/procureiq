package com.procureiq.capacityplanning;

import java.math.BigDecimal;
import java.util.UUID;

public record CapacityMemberResponse(
        UUID userId,
        String userName,
        String role,
        BigDecimal annualCapacityHours,
        BigDecimal reservedOperationalPct,
        BigDecimal effectiveCapacityHours,
        BigDecimal assignedEffortHours,
        BigDecimal remainingCapacityHours,
        BigDecimal overloadHours,
        BigDecimal utilizationPct,
        CapacityHealth health
) {
}
