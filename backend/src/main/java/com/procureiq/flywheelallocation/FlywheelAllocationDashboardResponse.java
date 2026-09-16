package com.procureiq.flywheelallocation;

import java.util.List;

public record FlywheelAllocationDashboardResponse(
        FlywheelAllocationSummaryResponse summary,

        List<FlywheelAllocationUserOptionResponse> users,

        List<FlywheelAllocationStrategyResponse> strategies,

        List<FlywheelAllocationMandateResponse> mandates,

        List<FlywheelAllocationSnapshotSummaryResponse> snapshots
) {
}
