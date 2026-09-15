package com.procureiq.interventionexecution;

import com.procureiq.investmentintervention.InvestmentInterventionAction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InterventionExecutionCaseResponse(
        UUID id,
        String executionNumber,

        UUID interventionCaseId,
        String interventionNumber,

        UUID performanceCaseId,
        String performanceCaseNumber,

        UUID fundingCommitmentId,
        String fundingCommitmentNumber,

        UUID sourceValueCaseId,
        String sourceValueCaseNumber,

        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,

        InvestmentInterventionAction approvedAction,
        BigDecimal approvedAffectedCapitalAmount,

        UUID approvedTargetValueCaseId,
        String approvedTargetValueCaseNumber,
        String approvedTargetInitiativeTitle,

        BigDecimal sourceReleasedCapitalSnapshot,
        BigDecimal sourceRemainingCommitmentSnapshot,

        BigDecimal currentReleasedCapitalAmount,
        BigDecimal currentRemainingCommitmentAmount,

        UUID executionOwnerUserId,
        String executionOwnerName,
        String executionObjective,

        BigDecimal implementedCapitalAmount,
        BigDecimal remainingImplementationAmount,
        BigDecimal implementationPct,
        BigDecimal implementationVarianceAmount,
        InterventionExecutionHealth executionHealth,

        InterventionExecutionStatus status,

        boolean acknowledged,
        int evidenceCount,
        int verificationCount,

        String closeNote,
        String closedByName,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
