package com.procureiq.flywheelvariance;

import com.procureiq.flywheelsettlement.FlywheelSettlementItemStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelVarianceItemResponse(
        UUID id,
        UUID variancePlanId,

        UUID settlementItemId,

        UUID releaseItemId,
        UUID allocationItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceReleasedAmount,
        BigDecimal sourceSettledAmount,
        BigDecimal sourceVarianceAmount,

        FlywheelSettlementItemStatus sourceReconciliationStatus,

        FlywheelVarianceDecision decision,

        String decisionRationale,

        LocalDate targetDate,

        String addedByName,
        Instant addedAt
) {
}
