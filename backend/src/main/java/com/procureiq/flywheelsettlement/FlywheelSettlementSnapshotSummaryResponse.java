package com.procureiq.flywheelsettlement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelSettlementSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

        UUID settlementCaseId,
        String reconciliationNumber,

        UUID releaseBatchId,
        String releaseNumber,

        FlywheelSettlementCaseStatus caseStatus,

        String currency,
        int fiscalYear,

        BigDecimal sourceReleasedAmount,
        BigDecimal settledAmount,
        BigDecimal varianceAmount,
        BigDecimal settlementPct,

        int itemCount,
        int settledCount,
        int partialCount,
        int unresolvedCount,

        String capturedByName,
        Instant capturedAt
) {
}
