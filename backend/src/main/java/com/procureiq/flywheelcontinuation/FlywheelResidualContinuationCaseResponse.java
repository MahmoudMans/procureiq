package com.procureiq.flywheelcontinuation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelResidualContinuationCaseResponse(
        UUID id,
        String continuationNumber,
        UUID sourceOutcomeCaseId,
        String sourceOutcomeNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceRemainingResidualAmount,
        int sourceResidualItemCount,
        int itemCount,
        UUID ownerUserId,
        String ownerName,
        FlywheelResidualContinuationStatus status,
        UUID reviewSubmittedByUserId,
        Instant reviewSubmittedAt,
        UUID approvedByUserId,
        Instant approvedAt,
        String approvalNote,
        UUID closedByUserId,
        Instant closedAt,
        String closeNote,
        long version,
        UUID createdByUserId,
        Instant createdAt,
        Instant updatedAt
) {
}
