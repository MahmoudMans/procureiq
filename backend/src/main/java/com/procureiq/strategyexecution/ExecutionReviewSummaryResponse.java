package com.procureiq.strategyexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExecutionReviewSummaryResponse(
        UUID id,
        String reviewNumber,
        UUID roadmapId,
        String roadmapNumber,
        String roadmapTitle,
        int commitmentCount,
        int completedCommitmentCount,
        int blockedCommitmentCount,
        int atRiskCommitmentCount,
        int overdueCommitmentCount,
        BigDecimal plannedContributionPoints,
        BigDecimal reportedContributionPoints,
        BigDecimal validatedContributionPoints,
        BigDecimal valueAtRiskPoints,
        BigDecimal executionScore,
        ExecutionPortfolioHealth executionHealth,
        String capturedByName,
        Instant capturedAt
) {
}
