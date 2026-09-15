package com.procureiq.fundingexecution;

import java.math.BigDecimal;

public record FundingDashboardSummaryResponse(
        int candidateCount,
        int commitmentCount,
        int plannedCommitmentCount,
        int activeCommitmentCount,
        int fullyReleasedCommitmentCount,
        int closedCommitmentCount,
        BigDecimal totalAuthorizedCapitalAmount,
        BigDecimal totalCommittedCapitalAmount,
        BigDecimal totalReleasedAmount,
        BigDecimal totalRemainingCommitmentAmount
) {
}
