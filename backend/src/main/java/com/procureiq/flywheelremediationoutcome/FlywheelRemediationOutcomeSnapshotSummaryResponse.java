package com.procureiq.flywheelremediationoutcome;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelRemediationOutcomeSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID outcomeCaseId,
        String outcomeNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceResidualAmount,
        BigDecimal resolvedAmount,
        BigDecimal remainingResidualAmount,
        int itemCount,
        int unresolvedItemCount,
        FlywheelRemediationOutcomeStatus outcomeStatus,
        UUID capturedByUserId,
        Instant capturedAt,
        boolean sealed
) {
}
