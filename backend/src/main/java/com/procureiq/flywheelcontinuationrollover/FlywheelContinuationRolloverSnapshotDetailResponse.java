package com.procureiq.flywheelcontinuationrollover;

import java.util.List;

public record FlywheelContinuationRolloverSnapshotDetailResponse(
        FlywheelContinuationRolloverSnapshotSummaryResponse snapshot,
        List<FlywheelContinuationRolloverSnapshotItemResponse> items
) {
}
