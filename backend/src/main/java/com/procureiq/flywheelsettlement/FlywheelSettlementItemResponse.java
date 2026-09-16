package com.procureiq.flywheelsettlement;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelSettlementItemResponse(
        UUID id,
        UUID settlementCaseId,

        UUID releaseItemId,
        UUID allocationItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal sourceReleasedAmount,
        BigDecimal settledAmount,
        BigDecimal varianceAmount,

        FlywheelSettlementItemStatus reconciliationStatus,

        String evidenceReference,
        LocalDate evidenceDate,
        String evidenceNote,

        String addedByName,
        Instant addedAt
) {
}
