package com.procureiq.processmining;

import java.math.BigDecimal;

public record ProcessStageMetricResponse(
        ProcessEntityType entityType,
        String status,
        long completedTransitions,
        BigDecimal averageHours,
        BigDecimal p95Hours
) {
}
