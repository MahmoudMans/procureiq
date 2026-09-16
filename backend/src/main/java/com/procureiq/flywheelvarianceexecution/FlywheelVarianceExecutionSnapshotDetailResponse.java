package com.procureiq.flywheelvarianceexecution;

import java.util.List;

public record FlywheelVarianceExecutionSnapshotDetailResponse(
        FlywheelVarianceExecutionSnapshotSummaryResponse snapshot,
        List<FlywheelVarianceExecutionSnapshotItemResponse> items
) {
}
