package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelHealth;
import com.procureiq.capitalflywheel.CapitalFlywheelRecommendation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelStrategyItemResponse(
        UUID id,
        UUID portfolioId,

        UUID flywheelLineageId,
        String lineageNumber,

        UUID rootTargetValueCaseId,
        String rootTargetValueCaseNumber,
        String rootTargetInitiativeTitle,

        int lineageRootFiscalYear,
        int lineageCycleCount,

        BigDecimal lineageOriginalCapitalAmount,
        BigDecimal referenceNextCycleCapitalAmount,
        BigDecimal proposedCapacityAmount,

        BigDecimal cumulativeProjectedNetValueAmount,
        BigDecimal cumulativeCompoundingValueAmount,
        BigDecimal cumulativeDecayedValueAmount,

        BigDecimal cumulativeValueMultiple,
        BigDecimal latestMarginalValueMultiple,
        BigDecimal latestMarginalNetValueRetentionPct,

        boolean diminishingReturns,

        CapitalFlywheelHealth flywheelHealth,
        CapitalFlywheelRecommendation step66Recommendation,

        BigDecimal priorityScore,
        FlywheelStrategyAdvisory advisoryRecommendation,

        FlywheelStrategyDecision decision,

        String decisionNote,
        String decidedByName,
        Instant decidedAt,

        String addedByName,
        Instant addedAt
) {
}
