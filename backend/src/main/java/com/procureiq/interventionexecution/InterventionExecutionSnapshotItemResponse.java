package com.procureiq.interventionexecution;

import com.procureiq.investmentintervention.InvestmentInterventionAction;

import java.math.BigDecimal;
import java.util.UUID;

public record InterventionExecutionSnapshotItemResponse(
        UUID executionCaseId,
        String executionNumber,
        String interventionNumber,
        String initiativeTitle,
        String currency,
        InterventionExecutionStatus caseStatus,
        InvestmentInterventionAction approvedAction,
        BigDecimal approvedAffectedCapitalAmount,
        BigDecimal implementedCapitalAmount,
        BigDecimal remainingImplementationAmount,
        BigDecimal implementationPct,
        BigDecimal implementationVarianceAmount,
        InterventionExecutionHealth executionHealth,
        BigDecimal currentReleasedCapitalAmount,
        BigDecimal currentRemainingCommitmentAmount,
        String approvedTargetValueCaseNumber
) {
}
