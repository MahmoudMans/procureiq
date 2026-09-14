package com.procureiq.operatingrhythm;

import java.util.List;

public record OperatingRhythmAnalysis(
        OperatingRhythmMetrics metrics,
        List<OperatingRhythmDimensionMetric> dimensions
) {
}
