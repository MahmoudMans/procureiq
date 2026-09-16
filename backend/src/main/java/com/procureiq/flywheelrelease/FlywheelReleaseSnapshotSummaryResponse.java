package com.procureiq.flywheelrelease;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelReleaseSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

        UUID releaseBatchId,
        String releaseNumber,

        UUID allocationMandateId,
        String allocationMandateNumber,

        FlywheelReleaseBatchStatus releaseStatus,

        String currency,
        int fiscalYear,

        BigDecimal mandateAuthorizedAmount,

        BigDecimal batchPlannedReleaseAmount,
        BigDecimal batchReleasedAmount,

        BigDecimal cumulativeMandateReleasedAmount,
        BigDecimal remainingMandateAmount,
        BigDecimal cumulativeReleaseUtilizationPct,

        int itemCount,
        int pendingCount,
        int releasedCount,
        int cancelledCount,

        String capturedByName,
        Instant capturedAt
) {
}
