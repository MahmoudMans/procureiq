package com.procureiq.flywheelvariance;

import com.procureiq.flywheelsettlement.FlywheelSettlementItemStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelVarianceCandidateResponse(
        UUID settlementItemId,

        UUID releaseItemId,
        UUID allocationItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceReleasedAmount,
        BigDecimal sourceSettledAmount,
        BigDecimal sourceVarianceAmount,

        FlywheelSettlementItemStatus sourceReconciliationStatus
) {
}
