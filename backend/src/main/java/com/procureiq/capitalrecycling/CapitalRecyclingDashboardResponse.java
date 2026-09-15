package com.procureiq.capitalrecycling;

import java.util.List;

public record CapitalRecyclingDashboardResponse(
        CapitalRecyclingSummaryResponse summary,
        List<CapitalRecyclingUserOptionResponse> users,
        List<CapitalRecyclingCandidateResponse> candidates,
        List<CapitalRecyclingSourceResponse> sources,
        List<CapitalRecyclingSnapshotSummaryResponse> snapshots
) {
}
