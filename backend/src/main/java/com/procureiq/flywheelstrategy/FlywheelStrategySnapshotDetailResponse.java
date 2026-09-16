package com.procureiq.flywheelstrategy;

import java.util.List;

public record FlywheelStrategySnapshotDetailResponse(
        FlywheelStrategySnapshotSummaryResponse snapshot,
        List<FlywheelStrategySnapshotItemResponse> items
) {
}
