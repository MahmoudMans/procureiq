package com.procureiq.capitalredeployment;

import java.util.List;

public record CapitalRedeploymentSnapshotDetailResponse(
        CapitalRedeploymentSnapshotSummaryResponse snapshot,
        List<CapitalRedeploymentSnapshotItemResponse> items
) {
}
