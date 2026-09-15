package com.procureiq.capitalallocation;

import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalAllocationItemResponse(
        UUID id,
        UUID cycleId,
        UUID valueCaseId,
        String caseNumber,
        String persistencePlanNumber,
        String commitmentNumber,
        String initiativeNumber,
        String initiativeTitle,
        String valueOwnerName,
        String currency,
        int fiscalYear,
        BigDecimal requestedCapitalAmount,
        BigDecimal investmentCostSnapshot,
        BigDecimal durableHorizonValueSnapshot,
        BigDecimal netValueSnapshot,
        BigDecimal roiPctSnapshot,
        BigDecimal paybackMonthsSnapshot,
        BigDecimal persistencePctSnapshot,
        StrategicValueHealth valueHealthSnapshot,
        BigDecimal priorityScore,
        CapitalAllocationDecision recommendation,
        CapitalAllocationDecision decision,
        String decisionNote,
        String decidedByName,
        Instant decidedAt,
        Instant createdAt
) {
}
