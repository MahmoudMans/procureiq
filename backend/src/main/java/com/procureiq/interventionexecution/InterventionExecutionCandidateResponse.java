package com.procureiq.interventionexecution;

import com.procureiq.investmentintervention.InvestmentInterventionAction;
import com.procureiq.investmentintervention.InvestmentInterventionStatus;
import com.procureiq.investmentperformance.InvestmentPerformanceHealth;

import java.math.BigDecimal;
import java.util.UUID;

public record InterventionExecutionCandidateResponse(
        UUID interventionCaseId,
        String interventionNumber,
        InvestmentInterventionStatus interventionStatus,

        UUID performanceCaseId,
        String performanceCaseNumber,
        InvestmentPerformanceHealth currentPerformanceHealth,

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

        BigDecimal currentReleasedCapitalAmount,
        BigDecimal currentRemainingCommitmentAmount
) {
}
