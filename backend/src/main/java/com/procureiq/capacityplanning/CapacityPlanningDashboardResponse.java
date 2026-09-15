package com.procureiq.capacityplanning;

import java.util.List;

public record CapacityPlanningDashboardResponse(
        String currency,
        int fiscalYear,
        CapacitySummaryResponse summary,
        List<CapacityUserOptionResponse> users,
        List<CapacityProfileResponse> profiles,
        List<CapacityMemberResponse> members,
        List<CapacityWorkItemResponse> workItems,
        List<CapacityRebalanceSuggestionResponse> rebalancingSuggestions,
        List<CapacitySnapshotSummaryResponse> snapshots
) {
}
