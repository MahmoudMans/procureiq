package com.procureiq.capitalflywheel;

import java.util.List;

public record CapitalFlywheelSnapshotDetailResponse(
        CapitalFlywheelSnapshotSummaryResponse snapshot,
        List<CapitalFlywheelSnapshotItemResponse> items
) {
}
