package com.procureiq.capitalallocation;

import java.math.BigDecimal;

public record CapitalAllocationPortfolioResult(
        BigDecimal fundedAmount,
        BigDecimal remainingBudgetAmount,
        BigDecimal budgetUtilizationPct,
        BigDecimal fundedNetValueAmount,
        BigDecimal opportunityCostAmount
) {
}
