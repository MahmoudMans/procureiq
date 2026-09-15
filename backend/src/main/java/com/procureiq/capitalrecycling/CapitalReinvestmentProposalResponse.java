package com.procureiq.capitalrecycling;

import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalReinvestmentProposalResponse(
        UUID id,
        UUID recyclingSourceId,

        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeNumber,
        String targetInitiativeTitle,

        BigDecimal sourceAvailableCapitalSnapshot,
        BigDecimal requestedReinvestmentAmount,

        BigDecimal targetRoiPctSnapshot,
        BigDecimal targetPersistencePctSnapshot,
        BigDecimal targetNetValueSnapshot,
        StrategicValueHealth targetValueHealthSnapshot,

        String proposalRationale,
        String proposedByName,
        Instant proposedAt,

        CapitalReinvestmentDecisionResponse decision
) {
}
