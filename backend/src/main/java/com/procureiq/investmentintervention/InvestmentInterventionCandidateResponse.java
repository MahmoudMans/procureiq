package com.procureiq.investmentintervention;

import com.procureiq.investmentperformance.InvestmentPerformanceCaseStatus;
import com.procureiq.investmentperformance.InvestmentPerformanceHealth;

import java.math.BigDecimal;
import java.util.UUID;

public record InvestmentInterventionCandidateResponse(
        UUID performanceCaseId,
        String performanceCaseNumber,
        InvestmentPerformanceCaseStatus performanceStatus,
        InvestmentPerformanceHealth performanceHealth,

        UUID fundingCommitmentId,
        String fundingCommitmentNumber,

        UUID valueCaseId,
        String valueCaseNumber,

        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,

        BigDecimal releasedCapitalAmount,
        BigDecimal remainingCommitmentAmount,

        BigDecimal baselineRoiPct,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal capitalEfficiencyMultiple,
        BigDecimal valueVarianceAmount,

        InvestmentInterventionAction recommendation,
        BigDecimal recommendedAffectedCapitalAmount
) {
}
