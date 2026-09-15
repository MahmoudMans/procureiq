package com.procureiq.investmentintervention;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InvestmentInterventionProposalResponse(
        UUID id,
        UUID interventionCaseId,
        InvestmentInterventionAction actionType,
        BigDecimal sourceRemainingCapitalSnapshot,
        BigDecimal affectedCapitalAmount,
        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeTitle,
        String proposalRationale,
        String proposedByName,
        Instant proposedAt,
        InvestmentInterventionDecisionResponse decision
) {
}
