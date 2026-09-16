package com.procureiq.flywheelallocation;

import java.util.List;

public record FlywheelAllocationSnapshotDetailResponse(
        FlywheelAllocationSnapshotSummaryResponse snapshot,
        List<FlywheelAllocationSnapshotItemResponse> items
) {
}
