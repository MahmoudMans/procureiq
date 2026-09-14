package com.procureiq.analytics;

import java.math.BigDecimal;

public record AnalyticsBreakdownResponse(
        String label,
        BigDecimal value,
        long count,
        BigDecimal sharePercent
) {
}
