package com.procureiq.operatingrhythm;

import java.time.LocalDate;
import java.util.List;

public record OperatingRhythmDashboardResponse(
        String currency,
        LocalDate livePeriodStart,
        LocalDate livePeriodEnd,
        OperatingRhythmMetricsResponse liveMetrics,
        List<OperatingRhythmDimensionResponse> liveDomains,
        List<OperatingRhythmDimensionResponse> liveOwners,
        List<OperatingRhythmDimensionResponse> liveExceptionTypes,
        List<OperatingRhythmSnapshotSummaryResponse> snapshots
) {
}
