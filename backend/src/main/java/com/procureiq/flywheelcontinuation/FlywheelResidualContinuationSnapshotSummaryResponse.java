package com.procureiq.flywheelcontinuation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelResidualContinuationSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID continuationCaseId,
        String continuationNumber,
        UUID sourceOutcomeCaseId,
        String sourceOutcomeNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceRemainingResidualAmount,
        int itemCount,
        FlywheelResidualContinuationStatus continuationStatus,
        UUID capturedByUserId,
        Instant capturedAt,
        boolean sealed
) {
}
