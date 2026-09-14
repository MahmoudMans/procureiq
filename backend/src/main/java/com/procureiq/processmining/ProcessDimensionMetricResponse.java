package com.procureiq.processmining;

import java.math.BigDecimal;

public record ProcessDimensionMetricResponse(
        String dimensionType,
        String dimensionValue,
        long activeItems,
        long bottlenecks,
        BigDecimal averageAgeHours
) {
}
