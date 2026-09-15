package com.procureiq.outcomepersistence;

import java.math.BigDecimal;

public record OutcomePersistenceSummaryResponse(
        int candidateCount,
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
        PersistenceHealth portfolioHealth
) {
}
