package com.procureiq.flywheelvariance;

import java.util.List;

public record FlywheelVarianceSnapshotDetailResponse(
        FlywheelVarianceSnapshotSummaryResponse snapshot,
        List<FlywheelVarianceSnapshotItemResponse> items
) {
}
