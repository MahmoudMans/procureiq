package com.procureiq.strategicokr;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OkrSnapshotKeyResultResponse(
        UUID id,
        UUID keyResultId,
        String title,
        KeyResultMetricType metricType,
        KeyResultDirection direction,
        KeyResultSourceType sourceType,
        OkrSourceScopeType sourceScopeType,
        String sourceScopeKey,
        BigDecimal baselineValue,
        BigDecimal targetValue,
        BigDecimal actualValue,
        BigDecimal weightPct,
        BigDecimal progressPct,
        StrategicHealth health,
        BigDecimal confidencePct,
        Instant sourceObservedAt,
        int contributionCount
) {
}
