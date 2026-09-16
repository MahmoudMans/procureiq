package com.procureiq.flywheelsettlement;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelSettlementCandidateItemResponse(
        UUID releaseItemId,
        UUID allocationItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceReleasedAmount,

        String executionReference
) {
}
