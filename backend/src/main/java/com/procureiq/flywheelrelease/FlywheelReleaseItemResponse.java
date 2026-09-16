package com.procureiq.flywheelrelease;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelReleaseItemResponse(
        UUID id,
        UUID releaseBatchId,

        UUID allocationItemId,
        UUID strategyItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal mandateAuthorizedItemAmount,
        BigDecimal strategyPriorityScore,

        BigDecimal plannedReleaseAmount,

        FlywheelReleaseItemStatus status,

        String executionReference,
        String executionNote,

        String releasedByName,
        Instant releasedAt,

        String cancellationNote,
        String cancelledByName,
        Instant cancelledAt,

        String addedByName,
        Instant addedAt
) {
}
