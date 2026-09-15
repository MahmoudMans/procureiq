package com.procureiq.capitalallocation;

import java.util.List;

public record CapitalAllocationDashboardResponse(
        CapitalAllocationDashboardSummaryResponse summary,
        List<CapitalAllocationCandidateResponse> candidates,
        List<CapitalAllocationCycleResponse> cycles,
        List<CapitalAllocationSnapshotSummaryResponse> snapshots
) {
}
