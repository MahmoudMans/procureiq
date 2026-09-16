package com.procureiq.flywheelcontinuationoutcome;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelContinuationOutcomeCaseResponse(
        UUID id,
        String outcomeNumber,
        UUID sourceContinuationCaseId,
        String sourceContinuationNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceResidualAmount,
        int sourceItemCount,
        int itemCount,
        BigDecimal currentRemainingResidualAmount,
        UUID ownerUserId,
        String ownerName,
        FlywheelContinuationOutcomeStatus status,
        FlywheelContinuationOutcomeResidualDisposition residualDisposition,
        BigDecimal verifiedRemainingResidualAmount,
        UUID reviewSubmittedByUserId,
        Instant reviewSubmittedAt,
        UUID verifiedByUserId,
        Instant verifiedAt,
        String verificationNote,
        UUID closedByUserId,
        Instant closedAt,
        String closeNote,
        long version,
        UUID createdByUserId,
        Instant createdAt,
        Instant updatedAt
) {
}
