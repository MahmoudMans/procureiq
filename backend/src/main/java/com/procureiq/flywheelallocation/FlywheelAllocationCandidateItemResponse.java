package com.procureiq.flywheelallocation;

import com.procureiq.flywheelstrategy.FlywheelStrategyAdvisory;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelAllocationCandidateItemResponse(
        UUID strategyItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal strategyProposedCapacityAmount,
        BigDecimal strategyPriorityScore,

        FlywheelStrategyAdvisory strategyAdvisoryRecommendation
) {
}
