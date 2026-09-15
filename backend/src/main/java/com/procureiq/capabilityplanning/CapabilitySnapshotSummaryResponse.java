package com.procureiq.capabilityplanning;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapabilitySnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        String currency,
        int fiscalYear,
        BigDecimal capabilityScore,
        CapabilityReadiness capabilityHealth,
        int criticalGapCount,
        int openDevelopmentActionCount,
        String capturedByName,
        Instant capturedAt
) {
}
