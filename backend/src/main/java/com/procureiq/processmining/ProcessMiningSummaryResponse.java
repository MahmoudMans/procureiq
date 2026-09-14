package com.procureiq.processmining;

import java.math.BigDecimal;

public record ProcessMiningSummaryResponse(
        long trackedEntities,
        long liveTransitions,
        long activeEntities,
        long bottlenecks,
        long criticalBottlenecks,
        long cancelledFlows,
        long repeatedStages,
        BigDecimal averageObservedCycleHours
) {
}
