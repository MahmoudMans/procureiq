package com.procureiq.strategyrecovery;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RecoveryReviewSummaryResponse(
        UUID id,
        String reviewNumber,
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
        RecoveryHealth portfolioHealth,
        String capturedByName,
        Instant capturedAt
) {
}
