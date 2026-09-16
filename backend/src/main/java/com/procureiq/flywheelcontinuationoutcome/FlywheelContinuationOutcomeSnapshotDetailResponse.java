package com.procureiq.flywheelcontinuationoutcome;

import java.util.List;

public record FlywheelContinuationOutcomeSnapshotDetailResponse(
        FlywheelContinuationOutcomeSnapshotSummaryResponse snapshot,
        List<FlywheelContinuationOutcomeSnapshotItemResponse> items
) {
}
