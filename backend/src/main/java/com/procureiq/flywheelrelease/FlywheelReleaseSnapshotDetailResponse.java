package com.procureiq.flywheelrelease;

import java.util.List;

public record FlywheelReleaseSnapshotDetailResponse(
        FlywheelReleaseSnapshotSummaryResponse snapshot,
        List<FlywheelReleaseSnapshotItemResponse> items
) {
}
