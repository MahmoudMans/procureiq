package com.procureiq.capitalallocation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalAllocationCycleResponse(
        UUID id,
        String cycleNumber,
        String title,
        String currency,
        int fiscalYear,
        BigDecimal budgetAmount,
        String objective,
        CapitalAllocationCycleStatus status,

        BigDecimal fundedAmount,
        BigDecimal remainingBudgetAmount,
        BigDecimal budgetUtilizationPct,
        BigDecimal fundedNetValueAmount,
        BigDecimal opportunityCostAmount,
        BigDecimal averagePriorityScore,

        int itemCount,
        int fundedItemCount,
        int deferredItemCount,
        int rejectedItemCount,
        int pendingItemCount,

        String approvedByName,
        Instant approvedAt,
        String approvalNote,
        String closedByName,
        Instant closedAt,
        String closeNote,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
