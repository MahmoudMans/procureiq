package com.procureiq.flywheelremediationoutcome;

import java.util.List;

public record FlywheelRemediationOutcomeSnapshotDetailResponse(
        FlywheelRemediationOutcomeSnapshotSummaryResponse snapshot,
        List<FlywheelRemediationOutcomeSnapshotItemResponse> items
) {
}
