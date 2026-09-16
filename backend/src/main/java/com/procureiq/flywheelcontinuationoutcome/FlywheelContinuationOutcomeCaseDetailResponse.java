package com.procureiq.flywheelcontinuationoutcome;

import java.util.List;

public record FlywheelContinuationOutcomeCaseDetailResponse(
        FlywheelContinuationOutcomeCaseResponse outcomeCase,
        List<FlywheelContinuationOutcomeItemResponse> items,
        List<FlywheelContinuationOutcomeCandidateResponse> candidates,
        List<FlywheelContinuationOutcomeSnapshotSummaryResponse> snapshots
) {
}
