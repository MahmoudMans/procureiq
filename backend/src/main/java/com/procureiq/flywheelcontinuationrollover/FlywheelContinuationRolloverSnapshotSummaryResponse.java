package com.procureiq.flywheelcontinuationrollover;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelContinuationRolloverSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID rolloverCaseId,
        String rolloverNumber,
        UUID sourceContinuationOutcomeCaseId,
        String sourceContinuationOutcomeNumber,
        UUID parentContinuationCaseId,
        String parentContinuationNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceRemainingResidualAmount,
        int itemCount,
        FlywheelContinuationRolloverStatus rolloverStatus,
        UUID capturedByUserId,
        Instant capturedAt,
        boolean sealed
) {
}
