package com.procureiq.outcomepersistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PersistenceReviewSummaryResponse(
        UUID id,
        String reviewNumber,
        int activePlanCount,
        int remediationPlanCount,
        int readyForReviewCount,
        int sustainedPlanCount,
        int dueObservationCount,
        int decayedPlanCount,
        int overdueControlCount,
        BigDecimal assessedBaselinePoints,
        BigDecimal currentValidatedPoints,
        BigDecimal totalDecayPoints,
        BigDecimal averagePersistencePct,
        PersistenceHealth portfolioHealth,
        String capturedByName,
        Instant capturedAt
) {
}
