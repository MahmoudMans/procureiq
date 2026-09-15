package com.procureiq.investmentintervention;

import java.time.Instant;
import java.util.UUID;

public record InvestmentInterventionDecisionResponse(
        UUID id,
        UUID proposalId,
        InvestmentInterventionDecision decision,
        String decisionNote,
        String decidedByName,
        Instant decidedAt
) {
}
