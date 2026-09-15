package com.procureiq.strategyexecution;

import java.math.BigDecimal;

public record ExecutionPortfolioResult(
        BigDecimal averageProgressPct,
        BigDecimal scheduleHealthPct,
        BigDecimal outcomeValidationPct,
        BigDecimal executionScore,
        BigDecimal valueAtRiskPoints,
        ExecutionPortfolioHealth health
) {
}
