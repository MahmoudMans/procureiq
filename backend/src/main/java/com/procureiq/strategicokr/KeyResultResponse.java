package com.procureiq.strategicokr;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record KeyResultResponse(
        UUID id,
        UUID objectiveId,
        String title,
        String description,
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
        Instant actualUpdatedAt,
        String manualNote,
        String status,
        List<OkrContributionResponse> contributions
) {
}
