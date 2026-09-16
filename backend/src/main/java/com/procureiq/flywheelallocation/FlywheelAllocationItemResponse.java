package com.procureiq.flywheelallocation;

import com.procureiq.flywheelstrategy.FlywheelStrategyAdvisory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelAllocationItemResponse(
        UUID id,
        UUID mandateId,

        UUID strategyItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal strategyProposedCapacityAmount,
        BigDecimal strategyPriorityScore,

        FlywheelStrategyAdvisory strategyAdvisoryRecommendation,

        BigDecimal requestedAllocationAmount,

        String addedByName,
        Instant addedAt
) {
}
