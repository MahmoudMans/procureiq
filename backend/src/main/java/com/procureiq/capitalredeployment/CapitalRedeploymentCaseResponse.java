package com.procureiq.capitalredeployment;

import com.procureiq.capitalrecycling.CapitalRecyclingSourceStatus;
import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalRedeploymentCaseResponse(
        UUID id,
        String redeploymentNumber,

        UUID recyclingSourceId,
        String recyclingSourceNumber,
        CapitalRecyclingSourceStatus currentRecyclingSourceStatus,

        UUID reinvestmentProposalId,

        UUID sourceFundingCommitmentId,
        String sourceFundingCommitmentNumber,

        UUID sourceValueCaseId,
        String sourceValueCaseNumber,

        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeNumber,
        String targetInitiativeTitle,

        String currency,
        int fiscalYear,

        BigDecimal approvedRedeploymentAmount,
        BigDecimal sourceRecyclableCapitalSnapshot,
        BigDecimal sourceFundingRemainingSnapshot,
        BigDecimal currentSourceFundingRemainingAmount,

        BigDecimal targetRoiPctSnapshot,
        BigDecimal targetPersistencePctSnapshot,
        BigDecimal targetNetValueSnapshot,
        StrategicValueHealth targetValueHealthSnapshot,

        UUID redeploymentOwnerUserId,
        String redeploymentOwnerName,
        String redeploymentObjective,

        BigDecimal releasedRedeploymentAmount,
        BigDecimal remainingRedeploymentAmount,
        BigDecimal redeploymentPct,
        BigDecimal redeploymentVarianceAmount,
        CapitalRedeploymentHealth redeploymentHealth,

        CapitalRedeploymentStatus status,

        int gateCount,
        int resolvedGateCount,
        int pendingGateCount,
        int authorizationCount,
        int releaseCount,
        int verificationCount,

        String closeNote,
        String closedByName,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
