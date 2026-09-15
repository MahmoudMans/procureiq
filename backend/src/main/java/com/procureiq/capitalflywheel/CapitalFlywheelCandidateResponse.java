package com.procureiq.capitalflywheel;

import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceHealth;
import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalFlywheelCandidateResponse(
        UUID persistenceCaseId,
        String persistenceCaseNumber,
        ReinvestmentPersistenceStatus persistenceStatus,

        UUID sourcePerformanceCaseId,
        String sourcePerformanceCaseNumber,

        UUID redeploymentCaseId,
        String redeploymentNumber,

        UUID recyclingSourceId,
        String recyclingSourceNumber,

        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeTitle,

        String currency,
        int fiscalYear,

        BigDecimal redeployedCapitalAmount,

        BigDecimal baselineNetValueAmount,
        BigDecimal projectedNetValueAmount,
        BigDecimal projectedHorizonValueAmount,
        BigDecimal projectedRoiPct,

        BigDecimal valuePersistencePct,
        BigDecimal efficiencyRetentionPct,
        BigDecimal capitalEfficiencyMultiple,

        BigDecimal compoundingValueAmount,
        BigDecimal decayedValueAmount,

        ReinvestmentPersistenceHealth persistenceHealth
) {
}
