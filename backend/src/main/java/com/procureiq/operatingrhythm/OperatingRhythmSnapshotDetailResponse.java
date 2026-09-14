package com.procureiq.operatingrhythm;

import java.time.LocalDate;
import java.util.List;

public record OperatingRhythmSnapshotDetailResponse(
        OperatingRhythmSnapshotSummaryResponse snapshot,
        OperatingRhythmMetricsResponse metrics,
        LocalDate periodStart,
        LocalDate periodEnd,
        List<OperatingRhythmDimensionResponse> domains,
        List<OperatingRhythmDimensionResponse> owners,
        List<OperatingRhythmDimensionResponse> severities,
        List<OperatingRhythmDimensionResponse> exceptionTypes
) {
}
