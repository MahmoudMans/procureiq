package com.procureiq.analytics;

import java.math.BigDecimal;

public record AnalyticsSummaryResponse(
        BigDecimal committedSpend,
        long committedOrderCount,
        long activeSuppliers,
        BigDecimal sourcingSavings,
        BigDecimal averageProcurementCycleDays,
        BigDecimal averageOrderValue,
        long openDeliveryOrders,
        long overdueDeliveryOrders
) {
}
