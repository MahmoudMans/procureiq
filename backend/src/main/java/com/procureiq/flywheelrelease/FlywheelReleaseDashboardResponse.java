package com.procureiq.flywheelrelease;

import java.util.List;

public record FlywheelReleaseDashboardResponse(
        FlywheelReleaseSummaryResponse summary,

        List<FlywheelReleaseUserOptionResponse> users,

        List<FlywheelReleaseMandateAuthorityResponse> mandates,

        List<FlywheelReleaseBatchResponse> batches,

        List<FlywheelReleaseSnapshotSummaryResponse> snapshots
) {
}
