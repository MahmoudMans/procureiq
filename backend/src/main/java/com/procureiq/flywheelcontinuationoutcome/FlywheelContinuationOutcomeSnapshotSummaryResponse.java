package com.procureiq.flywheelcontinuationoutcome;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelContinuationOutcomeSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID outcomeCaseId,
        String outcomeNumber,
        UUID sourceContinuationCaseId,
        String sourceContinuationNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceResidualAmount,
        BigDecimal remainingResidualAmount,
        int itemCount,
        FlywheelContinuationOutcomeStatus outcomeStatus,
        FlywheelContinuationOutcomeResidualDisposition residualDisposition,
        UUID capturedByUserId,
        Instant capturedAt,
        boolean sealed
) {
}
