package com.procureiq.investmentperformance;

import java.util.List;

public record InvestmentPerformanceSnapshotDetailResponse(
        InvestmentPerformanceSnapshotSummaryResponse snapshot,
        List<InvestmentPerformanceSnapshotItemResponse> items
) {
}
