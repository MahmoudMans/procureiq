package com.procureiq.governancereview;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record GovernanceReviewSummaryResponse(
        UUID id,
        String reviewNumber,
        String title,
        LocalDate periodStart,
        LocalDate periodEnd,
        String currency,
        GovernanceReviewStatus status,

        UUID ownerUserId,
        String ownerName,

        UUID chairUserId,
        String chairName,

        BigDecimal snapshotTargetSavings,
        BigDecimal snapshotValidatedSavings,
        BigDecimal snapshotAtRiskAmount,
        long snapshotCriticalSuppliers,

        long openDecisions,
        long openActions,
        long overdueActions,

        Instant frozenAt,
        Instant openedAt,
        Instant closedAt,
        Instant archivedAt,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
