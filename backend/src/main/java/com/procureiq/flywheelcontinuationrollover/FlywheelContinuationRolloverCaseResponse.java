package com.procureiq.flywheelcontinuationrollover;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelContinuationRolloverCaseResponse(
        UUID id,
        String rolloverNumber,
        UUID sourceContinuationOutcomeCaseId,
        String sourceContinuationOutcomeNumber,
        UUID parentContinuationCaseId,
        String parentContinuationNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceRemainingResidualAmount,
        int sourceResidualItemCount,
        int itemCount,
        UUID ownerUserId,
        String ownerName,
        FlywheelContinuationRolloverStatus status,
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
