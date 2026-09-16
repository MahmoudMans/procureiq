package com.procureiq.flywheelcontinuationrollover;

import java.util.List;

public record FlywheelContinuationRolloverCaseDetailResponse(
        FlywheelContinuationRolloverCaseResponse rolloverCase,
        List<FlywheelContinuationRolloverItemResponse> items,
        List<FlywheelContinuationRolloverCandidateResponse> candidates,
        List<FlywheelContinuationRolloverSnapshotSummaryResponse> snapshots
) {
}
