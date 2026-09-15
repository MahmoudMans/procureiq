package com.procureiq.reinvestmentpersistence;

import java.math.BigDecimal;
import java.util.UUID;

public record ReinvestmentPersistenceSnapshotItemResponse(
        UUID persistenceCaseId,
        String persistenceCaseNumber,
        String sourcePerformanceCaseNumber,
        String redeploymentNumber,
        String targetValueCaseNumber,
        String targetInitiativeTitle,
        String currency,

        ReinvestmentPersistenceStatus caseStatus,
        boolean assessed,

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
        BigDecimal efficiencyRetentionPct,

        BigDecimal compoundingValueAmount,
        BigDecimal decayedValueAmount,

        ReinvestmentPersistenceHealth health
) {
}
