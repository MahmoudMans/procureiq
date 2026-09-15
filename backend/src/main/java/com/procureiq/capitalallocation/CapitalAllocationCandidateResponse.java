package com.procureiq.capitalallocation;

import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalAllocationCandidateResponse(
        UUID valueCaseId,
        String caseNumber,
        String persistencePlanNumber,
        String commitmentNumber,
        String initiativeNumber,
        String initiativeTitle,
        String valueOwnerName,
        String currency,
        int fiscalYear,
        BigDecimal investmentCostAmount,
        BigDecimal durableHorizonValueAmount,
        BigDecimal netValueAmount,
        BigDecimal roiPct,
        BigDecimal paybackMonths,
        BigDecimal persistencePct,
        StrategicValueHealth valueHealth,
        BigDecimal priorityScore,
        CapitalAllocationDecision recommendation
) {
}
