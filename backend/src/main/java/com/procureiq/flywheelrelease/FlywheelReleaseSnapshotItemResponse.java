package com.procureiq.flywheelrelease;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelReleaseSnapshotItemResponse(
        UUID allocationItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal mandateAuthorizedItemAmount,
        BigDecimal plannedReleaseAmount,

        FlywheelReleaseItemStatus releaseItemStatus,

        String executionReference,
        String executionNote,
        String cancellationNote
) {
}
