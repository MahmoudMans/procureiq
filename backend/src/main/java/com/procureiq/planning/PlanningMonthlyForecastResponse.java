package com.procureiq.planning;

import java.math.BigDecimal;

public record PlanningMonthlyForecastResponse(
        String month,
        BigDecimal plannedValue,
        BigDecimal linkedActualValue,
        long initiativeCount
) {
}
