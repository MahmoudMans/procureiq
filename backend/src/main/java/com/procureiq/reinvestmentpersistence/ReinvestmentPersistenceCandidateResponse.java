package com.procureiq.reinvestmentpersistence;

import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceHealth;
import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record ReinvestmentPersistenceCandidateResponse(
        UUID sourcePerformanceCaseId,
        String sourcePerformanceCaseNumber,
        ReinvestmentPerformanceStatus sourcePerformanceStatus,

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

        int measurementHorizonMonths
) {
}
