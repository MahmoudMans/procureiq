package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelHealth;
import com.procureiq.capitalflywheel.CapitalFlywheelRecommendation;
import com.procureiq.capitalflywheel.CapitalFlywheelStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelStrategyCandidateResponse(
        UUID flywheelLineageId,
        String lineageNumber,

        CapitalFlywheelStatus lineageStatus,

        UUID rootTargetValueCaseId,
        String rootTargetValueCaseNumber,
        String rootTargetInitiativeTitle,

        String currency,
        int rootFiscalYear,

        int cycleCount,

        BigDecimal lineageOriginalCapitalAmount,
        BigDecimal referenceNextCycleCapitalAmount,

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
        FlywheelStrategyAdvisory advisoryRecommendation
) {
}
