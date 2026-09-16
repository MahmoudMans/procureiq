package com.procureiq.flywheelrelease;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelReleaseBatchResponse(
        UUID id,
        String releaseNumber,

        UUID allocationMandateId,
        String allocationMandateNumber,

        UUID strategyPortfolioId,
        String strategyPortfolioNumber,

        String title,

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

        UUID releaseOwnerUserId,
        String releaseOwnerName,

        String releaseRationale,

        FlywheelReleaseBatchStatus status,

        String submittedByName,
        Instant submittedAt,

        String executionNote,
        String executedByName,
        Instant executedAt,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,

        long version
) {
}
