package com.procureiq.flywheelsettlement;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelSettlementSnapshotItemResponse(
        UUID releaseItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceReleasedAmount,
        BigDecimal settledAmount,
        BigDecimal varianceAmount,

        FlywheelSettlementItemStatus reconciliationStatus,

        String evidenceReference,
        LocalDate evidenceDate,
        String evidenceNote
) {
}
