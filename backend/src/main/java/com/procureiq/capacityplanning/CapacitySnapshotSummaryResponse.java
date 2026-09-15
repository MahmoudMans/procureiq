package com.procureiq.capacityplanning;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapacitySnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        String currency,
        int fiscalYear,
        BigDecimal capacityScore,
        CapacityHealth portfolioHealth,
        BigDecimal effectiveCapacityHours,
        BigDecimal estimatedDemandHours,
        BigDecimal capacityGapHours,
        int overloadedMemberCount,
        int deadlinePressureCount,
        String capturedByName,
        Instant capturedAt
) {
}
