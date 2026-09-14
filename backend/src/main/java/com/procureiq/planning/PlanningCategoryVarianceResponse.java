package com.procureiq.planning;

import java.math.BigDecimal;

public record PlanningCategoryVarianceResponse(
        String category,
        BigDecimal plannedValue,
        BigDecimal linkedActualValue,
        BigDecimal variance,
        long initiativeCount
) {
}
