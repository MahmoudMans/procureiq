package com.procureiq.fundingexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FundingCommitmentResponse(
        UUID id,
        String commitmentNumber,
        UUID allocationCycleId,
        String allocationCycleNumber,
        String allocationCycleTitle,
        UUID allocationItemId,
        UUID valueCaseId,
        String caseNumber,
        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,
        BigDecimal authorizedCapitalAmount,
        BigDecimal committedCapitalAmount,
        UUID fundingOwnerUserId,
        String fundingOwnerName,
        String objective,
        FundingCommitmentStatus status,

        BigDecimal plannedReleaseAmount,
        BigDecimal releasedAmount,
        BigDecimal remainingAuthorizationAmount,
        BigDecimal remainingCommitmentAmount,
        BigDecimal plannedCoveragePct,
        BigDecimal releasePct,

        int trancheCount,
        int releasedTrancheCount,
        int pendingGateCount,

        String activatedByName,
        Instant activatedAt,
        String activationNote,
        String closedByName,
        Instant closedAt,
        String closeNote,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
