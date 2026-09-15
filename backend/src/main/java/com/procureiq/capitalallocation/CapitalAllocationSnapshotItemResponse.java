package com.procureiq.capitalallocation;

import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalAllocationSnapshotItemResponse(
        UUID allocationItemId,
        String caseNumber,
        String initiativeNumber,
        String initiativeTitle,
        BigDecimal requestedCapitalAmount,
        BigDecimal durableHorizonValueAmount,
        BigDecimal netValueAmount,
        BigDecimal roiPct,
        BigDecimal paybackMonths,
        BigDecimal persistencePct,
        StrategicValueHealth valueHealth,
        BigDecimal priorityScore,
        CapitalAllocationDecision recommendation,
        CapitalAllocationDecision decision,
        String decisionNote
) {
}
