package com.procureiq.capitalallocation;

import java.util.List;

public record CapitalAllocationSnapshotDetailResponse(
        CapitalAllocationSnapshotSummaryResponse snapshot,
        List<CapitalAllocationSnapshotItemResponse> items
) {
}
