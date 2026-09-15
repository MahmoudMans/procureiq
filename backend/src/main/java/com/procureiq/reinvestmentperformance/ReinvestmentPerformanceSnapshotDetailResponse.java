package com.procureiq.reinvestmentperformance;

import java.util.List;

public record ReinvestmentPerformanceSnapshotDetailResponse(
        ReinvestmentPerformanceSnapshotSummaryResponse snapshot,
        List<ReinvestmentPerformanceSnapshotItemResponse> items
) {
}
