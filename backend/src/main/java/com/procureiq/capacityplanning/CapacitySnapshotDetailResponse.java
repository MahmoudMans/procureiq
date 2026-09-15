package com.procureiq.capacityplanning;

import java.util.List;

public record CapacitySnapshotDetailResponse(
        CapacitySnapshotSummaryResponse snapshot,
        CapacitySummaryResponse summary,
        List<CapacityMemberResponse> members,
        List<CapacityWorkItemResponse> workItems
) {
}
