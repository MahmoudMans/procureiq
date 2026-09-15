package com.procureiq.fundingexecution;

import com.procureiq.capitalallocation.CapitalAllocationCycleStatus;
import com.procureiq.capitalallocation.CapitalAllocationDecision;

import java.math.BigDecimal;
import java.util.UUID;

public record FundingCandidateResponse(
        UUID allocationCycleId,
        String allocationCycleNumber,
        String allocationCycleTitle,
        CapitalAllocationCycleStatus allocationCycleStatus,
        UUID allocationItemId,
        UUID valueCaseId,
        String caseNumber,
        String initiativeNumber,
        String initiativeTitle,
        String valueOwnerName,
        String currency,
        int fiscalYear,
        BigDecimal authorizedCapitalAmount,
        BigDecimal priorityScore,
        CapitalAllocationDecision recommendation,
        CapitalAllocationDecision allocationDecision,
        BigDecimal roiPct,
        BigDecimal persistencePct,
        BigDecimal netValueAmount
) {
}
