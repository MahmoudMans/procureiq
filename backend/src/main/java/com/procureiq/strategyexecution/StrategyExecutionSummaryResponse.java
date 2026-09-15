package com.procureiq.strategyexecution;

import java.math.BigDecimal;

public record StrategyExecutionSummaryResponse(
        int commitmentCount,
        int completedCommitmentCount,
        int blockedCommitmentCount,
        int atRiskCommitmentCount,
        int overdueCommitmentCount,
        BigDecimal plannedContributionPoints,
        BigDecimal reportedContributionPoints,
        BigDecimal validatedContributionPoints,
        BigDecimal valueAtRiskPoints,
        BigDecimal averageProgressPct,
        BigDecimal scheduleHealthPct,
        BigDecimal outcomeValidationPct,
        BigDecimal executionScore,
        ExecutionPortfolioHealth executionHealth
) {
}
