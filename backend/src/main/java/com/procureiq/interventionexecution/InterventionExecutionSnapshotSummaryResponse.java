package com.procureiq.interventionexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InterventionExecutionSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        int caseCount,
        int plannedCaseCount,
        int activeCaseCount,
        int readyCaseCount,
        int verifiedCaseCount,
        int remediationCaseCount,
        BigDecimal totalApprovedAffectedCapitalAmount,
        BigDecimal totalImplementedCapitalAmount,
        BigDecimal totalRemainingImplementationAmount,
        BigDecimal averageImplementationPct,
        String capturedByName,
        Instant capturedAt
) {
}
