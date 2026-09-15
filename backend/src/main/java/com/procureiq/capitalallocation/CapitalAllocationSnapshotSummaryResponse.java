package com.procureiq.capitalallocation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalAllocationSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID cycleId,
        String cycleNumber,
        String cycleTitle,
        String currency,
        int fiscalYear,
        CapitalAllocationCycleStatus cycleStatus,
        BigDecimal budgetAmount,
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
        String capturedByName,
        Instant capturedAt
) {
}
