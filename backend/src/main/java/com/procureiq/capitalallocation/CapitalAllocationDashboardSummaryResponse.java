package com.procureiq.capitalallocation;

public record CapitalAllocationDashboardSummaryResponse(
        int candidateCount,
        int cycleCount,
        int draftCycleCount,
        int inReviewCycleCount,
        int approvedCycleCount,
        int closedCycleCount
) {
}
