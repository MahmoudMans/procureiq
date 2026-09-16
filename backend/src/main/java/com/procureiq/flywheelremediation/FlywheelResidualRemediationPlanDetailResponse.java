package com.procureiq.flywheelremediation;

import java.util.List;

public record FlywheelResidualRemediationPlanDetailResponse(
        FlywheelResidualRemediationPlanResponse plan,
        List<FlywheelResidualRemediationItemResponse> items,
        List<FlywheelResidualRemediationCandidateResponse> candidates,
        List<FlywheelResidualRemediationSnapshotSummaryResponse> snapshots
) {
}
