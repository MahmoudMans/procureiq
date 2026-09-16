package com.procureiq.flywheelremediation;

import java.util.List;

public record FlywheelResidualRemediationSnapshotDetailResponse(
        FlywheelResidualRemediationSnapshotSummaryResponse snapshot,
        List<FlywheelResidualRemediationSnapshotItemResponse> items
) {
}
