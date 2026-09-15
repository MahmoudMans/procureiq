package com.procureiq.investmentperformance;

import com.procureiq.fundingexecution.FundingCommitmentStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record InvestmentPerformanceCandidateResponse(
        UUID fundingCommitmentId,
        String fundingCommitmentNumber,
        FundingCommitmentStatus fundingStatus,
        UUID allocationCycleId,
        String allocationCycleNumber,
        UUID valueCaseId,
        String valueCaseNumber,
        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,
        BigDecimal currentReleasedCapitalAmount,
        BigDecimal committedCapitalAmount,
        BigDecimal releasePct,
        BigDecimal baselineInvestmentCostAmount,
        BigDecimal baselineDurableHorizonValueAmount,
        BigDecimal baselineRoiPct,
        BigDecimal baselineTargetRoiPct
) {
}
