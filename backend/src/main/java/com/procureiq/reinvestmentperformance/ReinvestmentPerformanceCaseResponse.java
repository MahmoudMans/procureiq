package com.procureiq.reinvestmentperformance;

import com.procureiq.capitalredeployment.CapitalRedeploymentStatus;
import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ReinvestmentPerformanceCaseResponse(
        UUID id,
        String performanceCaseNumber,

        UUID redeploymentCaseId,
        String redeploymentNumber,
        CapitalRedeploymentStatus currentRedeploymentStatus,

        UUID recyclingSourceId,
        String recyclingSourceNumber,

        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeNumber,
        String targetInitiativeTitle,

        String currency,
        int fiscalYear,

        BigDecimal redeployedCapitalAmount,
        BigDecimal baselineTargetRoiPct,
        BigDecimal baselineTargetPersistencePct,
        BigDecimal baselineTargetNetValueAmount,
        StrategicValueHealth currentTargetValueHealth,

        int measurementHorizonMonths,
        BigDecimal annualOperatingCostAmount,

        UUID performanceOwnerUserId,
        String performanceOwnerName,
        String performanceObjective,

        boolean assessed,
        BigDecimal validatedRealizedAnnualizedValueAmount,
        BigDecimal operatingCostHorizonAmount,
        BigDecimal totalCostAmount,
        BigDecimal expectedHorizonValueAmount,
        BigDecimal realizedHorizonValueAmount,
        BigDecimal realizedNetValueAmount,
        BigDecimal realizedRoiPct,
        BigDecimal roiVariancePct,
        BigDecimal valueVarianceAmount,
        BigDecimal realizationPct,
        ReinvestmentPerformanceHealth health,

        ReinvestmentPerformanceStatus status,

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
