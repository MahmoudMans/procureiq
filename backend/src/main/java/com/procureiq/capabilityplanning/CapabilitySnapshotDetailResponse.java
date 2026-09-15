package com.procureiq.capabilityplanning;

import java.util.List;

public record CapabilitySnapshotDetailResponse(
        CapabilitySnapshotSummaryResponse snapshot,
        CapabilitySummaryResponse summary,
        List<CapabilityMemberResponse> members,
        List<CapabilityWorkItemResponse> workItems
) {
}
