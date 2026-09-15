package com.procureiq.capacityplanning;

import java.math.BigDecimal;
import java.util.UUID;

public record CapacityProfileResponse(
        UUID id,
        UUID userId,
        String userName,
        String role,
        int fiscalYear,
        BigDecimal annualCapacityHours,
        BigDecimal reservedOperationalPct,
        BigDecimal effectiveCapacityHours,
        String notes,
        long version
) {
}
