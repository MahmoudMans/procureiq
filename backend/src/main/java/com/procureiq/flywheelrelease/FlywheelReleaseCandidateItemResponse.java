package com.procureiq.flywheelrelease;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelReleaseCandidateItemResponse(
        UUID allocationItemId,
        UUID strategyItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal authorizedAllocationAmount,
        BigDecimal previouslyReleasedAmount,
        BigDecimal remainingReleaseAuthorityAmount,

        BigDecimal strategyPriorityScore
) {
}
