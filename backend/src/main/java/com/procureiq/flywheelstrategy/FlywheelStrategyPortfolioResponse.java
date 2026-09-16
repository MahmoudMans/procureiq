package com.procureiq.flywheelstrategy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelStrategyPortfolioResponse(
        UUID id,
        String portfolioNumber,
        String title,

        String currency,
        int fiscalYear,

        BigDecimal capitalCapacityAmount,
        BigDecimal prioritizedCapacityAmount,
        BigDecimal remainingCapacityAmount,
        BigDecimal capacityUtilizationPct,
        BigDecimal averagePriorityScore,

        UUID portfolioOwnerUserId,
        String portfolioOwnerName,
        String strategicObjective,

        FlywheelStrategyPortfolioStatus status,

        int itemCount,
        int prioritizeCount,
        int holdCount,
        int exitCount,
        int pendingCount,

        String approvalNote,
        String approvedByName,
        Instant approvedAt,

        String closeNote,
        String closedByName,
        Instant closedAt,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
