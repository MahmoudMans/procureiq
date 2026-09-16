package com.procureiq.flywheelvarianceexecution;

import java.util.List;

public record FlywheelVarianceExecutionCaseDetailResponse(
        FlywheelVarianceExecutionCaseResponse executionCase,

        FlywheelVarianceExecutionSourceResponse sourceAuthority,

        List<FlywheelVarianceExecutionUserOptionResponse> users,

        List<FlywheelVarianceExecutionCandidateResponse> candidates,

        List<FlywheelVarianceExecutionItemResponse> items,

        List<FlywheelVarianceExecutionSnapshotSummaryResponse> snapshots
) {
}
