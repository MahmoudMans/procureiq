package com.procureiq.reinvestmentpersistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ReinvestmentPersistenceReviewResponse(
        UUID id,
        UUID persistenceCaseId,
        UUID observationId,

        ReinvestmentPersistenceReviewDecision decision,
        ReinvestmentPersistenceHealth health,

        BigDecimal baselineAnnualizedValueAmount,
        BigDecimal currentAnnualizedValueAmount,

        BigDecimal baselineHorizonValueAmount,
        BigDecimal currentProjectedHorizonValueAmount,

        BigDecimal baselineNetValueAmount,
        BigDecimal currentProjectedNetValueAmount,

        BigDecimal baselineRoiPct,
        BigDecimal currentProjectedRoiPct,
        BigDecimal roiVariancePct,

        BigDecimal valuePersistencePct,
        BigDecimal compoundingValueAmount,
        BigDecimal decayedValueAmount,

        BigDecimal baselineCapitalEfficiencyMultiple,
        BigDecimal currentCapitalEfficiencyMultiple,
        BigDecimal capitalEfficiencyDelta,
        BigDecimal efficiencyRetentionPct,

        String reviewNote,
        String reviewedByName,
        Instant reviewedAt
) {
}
