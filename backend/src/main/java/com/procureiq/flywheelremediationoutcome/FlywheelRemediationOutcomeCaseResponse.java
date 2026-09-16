package com.procureiq.flywheelremediationoutcome;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelRemediationOutcomeCaseResponse(
        UUID id,
        String outcomeNumber,
        UUID sourceRemediationPlanId,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceResidualAmount,
        int sourceItemCount,
        BigDecimal resolvedAmount,
        BigDecimal remainingResidualAmount,
        int itemCount,
        int unresolvedItemCount,
        UUID ownerUserId,
        String ownerName,
        FlywheelRemediationOutcomeStatus status,
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
