package com.procureiq.interventionexecution;

import java.math.BigDecimal;

public record InterventionExecutionSummaryResponse(
        int candidateCount,
        int caseCount,
        int plannedCaseCount,
        int activeCaseCount,
        int readyCaseCount,
        int verifiedCaseCount,
        int remediationCaseCount,
        BigDecimal totalApprovedAffectedCapitalAmount,
        BigDecimal totalImplementedCapitalAmount,
        BigDecimal totalRemainingImplementationAmount,
        BigDecimal averageImplementationPct
) {
}
