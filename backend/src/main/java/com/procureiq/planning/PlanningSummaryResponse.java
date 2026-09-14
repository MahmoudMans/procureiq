package com.procureiq.planning;

import java.math.BigDecimal;

public record PlanningSummaryResponse(
        int fiscalYear,
        String currency,
        long activePlans,
        long plannedInitiatives,
        long upcomingInitiatives,
        long overdueInitiatives,
        long convertedInitiatives,
        BigDecimal plannedDemand,
        BigDecimal linkedActualDemand,
        BigDecimal variance,
        BigDecimal conversionRate
) {
}
