package com.procureiq.capitalrecycling;

import com.procureiq.investmentintervention.InvestmentInterventionAction;
import com.procureiq.interventionexecution.InterventionExecutionStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalRecyclingCandidateResponse(
        UUID executionCaseId,
        String executionNumber,
        InterventionExecutionStatus executionStatus,

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
        BigDecimal currentFundingRemainingAmount,
        BigDecimal recyclableCapitalAmount,

        UUID preferredTargetValueCaseId,
        String preferredTargetValueCaseNumber,
        String preferredTargetInitiativeTitle
) {
}
