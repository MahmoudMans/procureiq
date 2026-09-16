package com.procureiq.flywheelrelease;

import java.util.List;

public record FlywheelReleaseBatchDetailResponse(
        FlywheelReleaseBatchResponse batch,

        FlywheelReleaseMandateAuthorityResponse mandateAuthority,

        List<FlywheelReleaseUserOptionResponse> users,

        List<FlywheelReleaseCandidateItemResponse> candidates,

        List<FlywheelReleaseItemResponse> items,

        List<FlywheelReleaseSnapshotSummaryResponse> snapshots
) {
}
