package com.procureiq.flywheelstrategy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelStrategySnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

        UUID portfolioId,
        String portfolioNumber,

        String currency,
        int fiscalYear,

        FlywheelStrategyPortfolioStatus portfolioStatus,

        BigDecimal capitalCapacityAmount,

        int itemCount,
        int prioritizeCount,
        int holdCount,
        int exitCount,
        int pendingCount,

        BigDecimal prioritizedCapacityAmount,
        BigDecimal remainingCapacityAmount,
        BigDecimal capacityUtilizationPct,
        BigDecimal averagePriorityScore,

        String capturedByName,
        Instant capturedAt
) {
}
