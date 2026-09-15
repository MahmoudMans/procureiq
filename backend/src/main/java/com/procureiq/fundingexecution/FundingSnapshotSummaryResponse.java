package com.procureiq.fundingexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FundingSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID commitmentId,
        String commitmentNumber,
        String allocationCycleNumber,
        String caseNumber,
        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,
        FundingCommitmentStatus commitmentStatus,
        BigDecimal authorizedCapitalAmount,
        BigDecimal committedCapitalAmount,
        BigDecimal plannedReleaseAmount,
        BigDecimal releasedAmount,
        BigDecimal remainingCommitmentAmount,
        BigDecimal remainingAuthorizationAmount,
        BigDecimal releasePct,
        int trancheCount,
        int releasedTrancheCount,
        int pendingGateCount,
        String capturedByName,
        Instant capturedAt
) {
}
