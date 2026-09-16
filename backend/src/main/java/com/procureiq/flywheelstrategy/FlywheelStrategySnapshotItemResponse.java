package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelHealth;
import com.procureiq.capitalflywheel.CapitalFlywheelRecommendation;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelStrategySnapshotItemResponse(
        UUID flywheelLineageId,
        String lineageNumber,
        String rootTargetInitiativeTitle,

        BigDecimal proposedCapacityAmount,
        BigDecimal cumulativeProjectedNetValueAmount,

        BigDecimal cumulativeValueMultiple,
        BigDecimal latestMarginalValueMultiple,
        BigDecimal latestMarginalNetValueRetentionPct,

        boolean diminishingReturns,

        CapitalFlywheelHealth flywheelHealth,
        CapitalFlywheelRecommendation step66Recommendation,

        BigDecimal priorityScore,
        FlywheelStrategyAdvisory advisoryRecommendation,

        FlywheelStrategyDecision decision,
        String decisionNote
) {
}
