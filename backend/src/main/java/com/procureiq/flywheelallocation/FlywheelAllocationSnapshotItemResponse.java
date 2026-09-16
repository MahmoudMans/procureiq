package com.procureiq.flywheelallocation;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelAllocationSnapshotItemResponse(
        UUID strategyItemId,

        UUID flywheelLineageId,
        String lineageNumber,

        String rootTargetInitiativeTitle,

        BigDecimal strategyProposedCapacityAmount,
        BigDecimal strategyPriorityScore,

        BigDecimal requestedAllocationAmount
) {
}
