package com.procureiq.flywheelvariance;

import java.util.List;

public record FlywheelVariancePlanDetailResponse(
        FlywheelVariancePlanResponse plan,

        FlywheelVarianceSourceResponse sourceAuthority,

        List<FlywheelVarianceUserOptionResponse> users,

        List<FlywheelVarianceCandidateResponse> candidates,

        List<FlywheelVarianceItemResponse> items,

        List<FlywheelVarianceSnapshotSummaryResponse> snapshots
) {
}
