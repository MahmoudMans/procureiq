package com.procureiq.capitalrecycling;

import com.procureiq.investmentintervention.InvestmentInterventionAction;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalRecyclingSnapshotItemResponse(
        UUID recyclingSourceId,
        String sourceNumber,
        String executionNumber,
        String sourceInitiativeTitle,
        InvestmentInterventionAction sourceAction,
        String currency,
        CapitalRecyclingSourceStatus sourceStatus,
        BigDecimal recyclableCapitalAmount,
        BigDecimal approvedReinvestmentAmount,
        BigDecimal pendingReinvestmentAmount,
        BigDecimal availableCapitalAmount,
        BigDecimal utilizationPct,
        BigDecimal currentFundingRemainingAmount,
        String preferredTargetValueCaseNumber
) {
}
