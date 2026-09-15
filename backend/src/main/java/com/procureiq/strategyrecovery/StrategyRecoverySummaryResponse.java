package com.procureiq.strategyrecovery;

import java.math.BigDecimal;

public record StrategyRecoverySummaryResponse(
        int candidateCount,
        int openCaseCount,
        int inRecoveryCaseCount,
        int readyForVerificationCount,
        int verifiedCaseCount,
        int criticalCaseCount,
        int overdueActionCount,
        int escalationCount,
        BigDecimal totalBaselineValueAtRiskPoints,
        BigDecimal totalCurrentValueAtRiskPoints,
        BigDecimal averageEffectivenessPct,
        BigDecimal averageRecoveryScore,
        RecoveryHealth portfolioHealth
) {
}
