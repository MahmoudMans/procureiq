package com.procureiq.reinvestmentpersistence;

import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceHealth;
import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ReinvestmentPersistenceCaseResponse(
        UUID id,
        String persistenceCaseNumber,

        UUID sourcePerformanceCaseId,
        String sourcePerformanceCaseNumber,
        ReinvestmentPerformanceStatus currentSourcePerformanceStatus,

        UUID redeploymentCaseId,
        String redeploymentNumber,

        UUID recyclingSourceId,
        String recyclingSourceNumber,

        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeNumber,
        String targetInitiativeTitle,

        String currency,
        int fiscalYear,

        BigDecimal redeployedCapitalAmount,

        BigDecimal baselineValidatedAnnualizedValueAmount,
        BigDecimal baselineRealizedHorizonValueAmount,
        BigDecimal baselineRealizedNetValueAmount,
        BigDecimal baselineTotalCostAmount,

        BigDecimal baselineRealizedRoiPct,
        BigDecimal baselineRealizationPct,

        ReinvestmentPerformanceHealth baselinePerformanceHealth,
        ReinvestmentPerformanceHealth currentSourcePerformanceHealth,

        int measurementHorizonMonths,
        int persistenceObservationWindowMonths,

        BigDecimal minimumValuePersistencePct,
        BigDecimal minimumEfficiencyRetentionPct,

        UUID persistenceOwnerUserId,
        String persistenceOwnerName,
        String persistenceObjective,

        boolean assessed,

        BigDecimal currentValidatedAnnualizedValueAmount,

        BigDecimal currentProjectedHorizonValueAmount,
        BigDecimal currentProjectedNetValueAmount,
        BigDecimal currentProjectedRoiPct,
        BigDecimal roiVariancePct,

        BigDecimal valuePersistencePct,
        BigDecimal compoundingValueAmount,
        BigDecimal decayedValueAmount,

        BigDecimal baselineCapitalEfficiencyMultiple,
        BigDecimal currentCapitalEfficiencyMultiple,
        BigDecimal capitalEfficiencyDelta,
        BigDecimal efficiencyRetentionPct,

        ReinvestmentPersistenceHealth health,
        ReinvestmentPersistenceStatus status,

        int observationCount,
        int reviewCount,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
