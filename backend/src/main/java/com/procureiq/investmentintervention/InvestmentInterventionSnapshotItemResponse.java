package com.procureiq.investmentintervention;

import com.procureiq.investmentperformance.InvestmentPerformanceHealth;

import java.math.BigDecimal;
import java.util.UUID;

public record InvestmentInterventionSnapshotItemResponse(
        UUID interventionCaseId,
        String interventionNumber,
        String performanceCaseNumber,
        String fundingCommitmentNumber,
        String valueCaseNumber,
        String initiativeTitle,
        String currency,
        InvestmentInterventionStatus caseStatus,
        InvestmentPerformanceHealth currentPerformanceHealth,
        BigDecimal currentReleasedCapitalAmount,
        BigDecimal currentRemainingCommitmentAmount,
        BigDecimal currentRealizedRoiPct,
        BigDecimal currentRoiVariancePct,
        BigDecimal currentCapitalEfficiencyMultiple,
        BigDecimal currentValueVarianceAmount,
        InvestmentInterventionAction recommendedAction,
        InvestmentInterventionAction approvedAction,
        BigDecimal approvedAffectedCapitalAmount,
        String approvedTargetValueCaseNumber
) {
}
