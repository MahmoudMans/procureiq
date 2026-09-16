package com.procureiq.flywheelcontinuation;

import java.util.List;

public record FlywheelResidualContinuationSnapshotDetailResponse(
        FlywheelResidualContinuationSnapshotSummaryResponse snapshot,
        List<FlywheelResidualContinuationSnapshotItemResponse> items
) {
}
