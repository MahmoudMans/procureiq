package com.procureiq.successionplanning;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SuccessionSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        String currency,
        int fiscalYear,
        BigDecimal successionScore,
        SuccessionHealth successionHealth,
        int singlePointFailureCount,
        int criticalExposureCount,
        int readyCandidateCount,
        String capturedByName,
        Instant capturedAt
) {
}
