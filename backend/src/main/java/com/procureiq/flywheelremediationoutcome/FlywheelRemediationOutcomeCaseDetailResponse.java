package com.procureiq.flywheelremediationoutcome;

import java.util.List;

public record FlywheelRemediationOutcomeCaseDetailResponse(
        FlywheelRemediationOutcomeCaseResponse outcomeCase,
        List<FlywheelRemediationOutcomeItemResponse> items,
        List<FlywheelRemediationOutcomeCandidateResponse> candidates,
        List<FlywheelRemediationOutcomeSnapshotSummaryResponse> snapshots
) {
}
