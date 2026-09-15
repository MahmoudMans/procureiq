package com.procureiq.investmentintervention;

import java.math.BigDecimal;

public record InvestmentInterventionRecommendationResult(
        InvestmentInterventionAction action,
        BigDecimal recommendedAffectedCapitalAmount
) {
}
