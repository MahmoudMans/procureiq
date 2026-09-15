package com.procureiq.capitalflywheel;

import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalFlywheelCycleResponse(
        UUID id,
        UUID lineageId,
        int cycleIndex,

        UUID persistenceCaseId,
        String persistenceCaseNumber,

        String sourcePerformanceCaseNumber,
        String redeploymentNumber,
        String recyclingSourceNumber,

        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeTitle,

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

        ReinvestmentPersistenceHealth persistenceHealth,

        String relationshipRationale,
        String addedByName,
        Instant addedAt
) {
}
