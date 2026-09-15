package com.procureiq.capitalrecycling;

import com.procureiq.investmentintervention.InvestmentInterventionAction;
import com.procureiq.interventionexecution.InterventionExecutionStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalRecyclingSourceResponse(
        UUID id,
        String sourceNumber,

        UUID executionCaseId,
        String executionNumber,
        InterventionExecutionStatus currentExecutionStatus,

        UUID interventionCaseId,
        String interventionNumber,

        UUID fundingCommitmentId,
        String fundingCommitmentNumber,

        UUID sourceValueCaseId,
        String sourceValueCaseNumber,

        String sourceInitiativeNumber,
        String sourceInitiativeTitle,

        InvestmentInterventionAction sourceAction,

        String currency,
        int fiscalYear,

        BigDecimal verifiedImplementedCapitalAmount,
        BigDecimal recyclableCapitalAmount,
        BigDecimal fundingRemainingSnapshot,
        BigDecimal currentFundingRemainingAmount,

        BigDecimal approvedReinvestmentAmount,
        BigDecimal pendingReinvestmentAmount,
        BigDecimal availableCapitalAmount,
        BigDecimal utilizationPct,

        UUID preferredTargetValueCaseId,
        String preferredTargetValueCaseNumber,
        String preferredTargetInitiativeTitle,

        UUID sourceOwnerUserId,
        String sourceOwnerName,
        String recyclingObjective,

        CapitalRecyclingSourceStatus status,

        int proposalCount,
        int approvedProposalCount,
        int pendingProposalCount,

        String closeNote,
        String closedByName,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
