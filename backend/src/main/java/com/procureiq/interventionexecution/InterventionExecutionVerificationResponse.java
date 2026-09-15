package com.procureiq.interventionexecution;

import com.procureiq.investmentintervention.InvestmentInterventionAction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InterventionExecutionVerificationResponse(
        UUID id,
        UUID executionCaseId,
        InterventionExecutionVerificationDecision decision,
        InvestmentInterventionAction approvedAction,
        BigDecimal approvedAffectedCapitalAmount,
        BigDecimal implementedCapitalAmount,
        BigDecimal remainingImplementationAmount,
        BigDecimal implementationPct,
        BigDecimal implementationVarianceAmount,
        String verificationNote,
        String verifiedByName,
        Instant verifiedAt
) {
}
