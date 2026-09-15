package com.procureiq.investmentintervention;

import com.procureiq.investmentperformance.InvestmentPerformanceCaseStatus;
import com.procureiq.investmentperformance.InvestmentPerformanceHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InvestmentInterventionCaseResponse(
        UUID id,
        String interventionNumber,

        UUID performanceCaseId,
        String performanceCaseNumber,

        UUID fundingCommitmentId,
        String fundingCommitmentNumber,

        UUID valueCaseId,
        String valueCaseNumber,

        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,

        UUID interventionOwnerUserId,
        String interventionOwnerName,
        String interventionRationale,

        InvestmentPerformanceCaseStatus sourcePerformanceStatus,
        InvestmentPerformanceHealth sourcePerformanceHealth,
        BigDecimal sourceReleasedCapitalAmount,
        BigDecimal sourceRemainingCommitmentAmount,
        BigDecimal sourceBaselineRoiPct,
        BigDecimal sourceRealizedRoiPct,
        BigDecimal sourceRoiVariancePct,
        BigDecimal sourceCapitalEfficiencyMultiple,
        BigDecimal sourceValueVarianceAmount,

        InvestmentPerformanceCaseStatus currentPerformanceStatus,
        InvestmentPerformanceHealth currentPerformanceHealth,
        BigDecimal currentReleasedCapitalAmount,
        BigDecimal currentRemainingCommitmentAmount,
        BigDecimal currentRealizedRoiPct,
        BigDecimal currentRoiVariancePct,
        BigDecimal currentCapitalEfficiencyMultiple,
        BigDecimal currentValueVarianceAmount,

        InvestmentInterventionAction currentRecommendation,
        BigDecimal currentRecommendedAffectedCapitalAmount,

        InvestmentInterventionAction approvedAction,
        BigDecimal approvedAffectedCapitalAmount,
        String approvedTargetValueCaseNumber,

        InvestmentInterventionStatus status,
        int proposalCount,
        int decisionCount,

        String closeNote,
        String closedByName,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
