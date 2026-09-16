package com.procureiq.flywheelallocation;

import java.util.List;

public record FlywheelAllocationMandateDetailResponse(
        FlywheelAllocationMandateResponse mandate,

        FlywheelAllocationStrategyResponse strategyAuthority,

        List<FlywheelAllocationUserOptionResponse> users,

        List<FlywheelAllocationCandidateItemResponse> candidates,

        List<FlywheelAllocationItemResponse> items,

        List<FlywheelAllocationSnapshotSummaryResponse> snapshots
) {
}
