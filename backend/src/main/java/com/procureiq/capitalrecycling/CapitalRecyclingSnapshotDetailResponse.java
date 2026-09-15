package com.procureiq.capitalrecycling;

import java.util.List;

public record CapitalRecyclingSnapshotDetailResponse(
        CapitalRecyclingSnapshotSummaryResponse snapshot,
        List<CapitalRecyclingSnapshotItemResponse> items
) {
}
