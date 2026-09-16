package com.procureiq.flywheelcontinuation;

import java.util.List;

public record FlywheelResidualContinuationCaseDetailResponse(
        FlywheelResidualContinuationCaseResponse continuationCase,
        List<FlywheelResidualContinuationItemResponse> items,
        List<FlywheelResidualContinuationCandidateResponse> candidates,
        List<FlywheelResidualContinuationSnapshotSummaryResponse> snapshots
) {
}
