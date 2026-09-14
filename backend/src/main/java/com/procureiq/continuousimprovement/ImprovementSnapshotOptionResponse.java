package com.procureiq.continuousimprovement;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ImprovementSnapshotOptionResponse(
        UUID id,
        String snapshotNumber,
        String currency,
        LocalDate periodStart,
        LocalDate periodEnd,
        Instant capturedAt
) {
}
