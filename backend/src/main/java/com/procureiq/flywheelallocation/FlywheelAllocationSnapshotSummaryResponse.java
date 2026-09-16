package com.procureiq.flywheelallocation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelAllocationSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

        UUID mandateId,
        String mandateNumber,

        UUID strategyPortfolioId,
        String strategyPortfolioNumber,

        FlywheelAllocationMandateStatus mandateStatus,

        String currency,
        int fiscalYear,

        BigDecimal strategyPrioritizedCapacityAmount,
        BigDecimal requestedAllocationAmount,
        BigDecimal remainingStrategyCapacityAmount,
        BigDecimal allocationUtilizationPct,

        int itemCount,

        String capturedByName,
        Instant capturedAt
) {
}
