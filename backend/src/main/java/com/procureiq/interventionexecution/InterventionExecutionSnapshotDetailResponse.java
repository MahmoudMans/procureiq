package com.procureiq.interventionexecution;

import java.util.List;

public record InterventionExecutionSnapshotDetailResponse(
        InterventionExecutionSnapshotSummaryResponse snapshot,
        List<InterventionExecutionSnapshotItemResponse> items
) {
}
