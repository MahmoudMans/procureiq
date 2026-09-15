package com.procureiq.investmentperformance;

import com.procureiq.fundingexecution.FundingCommitmentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InvestmentPerformanceCaseResponse(
        UUID id,
        String performanceCaseNumber,

        UUID fundingCommitmentId,
        String fundingCommitmentNumber,
        FundingCommitmentStatus currentFundingStatus,
        UUID allocationCycleId,
        String allocationCycleNumber,

        UUID valueCaseId,
        String valueCaseNumber,

        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,

        UUID performanceOwnerUserId,
        String performanceOwnerName,
        String performanceObjective,

        BigDecimal baselineInvestmentCostAmount,
        BigDecimal baselineAnnualOperatingCostAmount,
        BigDecimal baselineAnnualizedValueAmount,
        BigDecimal baselineDurableAnnualValueAmount,
        BigDecimal baselineDurableHorizonValueAmount,
        BigDecimal baselineRoiPct,
        BigDecimal baselineTargetRoiPct,
        BigDecimal baselineTargetPaybackMonths,
        int valueHorizonMonths,

        BigDecimal currentReleasedCapitalAmount,
        BigDecimal currentReleasePct,

        boolean assessed,
        BigDecimal assessedReleasedCapitalAmount,
        BigDecimal validatedRealizedAnnualizedValueAmount,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedOperatingCostHorizonAmount,
        BigDecimal realizedTotalCostAmount,
        BigDecimal realizedNetValueAmount,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal fundingVarianceAmount,
        BigDecimal fundingVariancePct,
        BigDecimal capitalEfficiencyMultiple,
        BigDecimal valueVarianceAmount,
        InvestmentPerformanceHealth health,

        InvestmentPerformanceCaseStatus status,
        int observationCount,
        int decisionCount,

        String closeNote,
        String closedByName,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
