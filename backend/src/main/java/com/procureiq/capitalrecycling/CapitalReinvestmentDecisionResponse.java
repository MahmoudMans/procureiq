package com.procureiq.capitalrecycling;

import java.time.Instant;
import java.util.UUID;

public record CapitalReinvestmentDecisionResponse(
        UUID id,
        UUID proposalId,
        CapitalReinvestmentDecision decision,
        String decisionNote,
        String decidedByName,
        Instant decidedAt
) {
}
