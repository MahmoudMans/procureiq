package com.procureiq.reporting;

import java.math.BigDecimal;

public record ReportSummaryResponse(
        BigDecimal committedSpend,
        BigDecimal sourcingSavings,
        long purchaseOrderCount,
        long supplierCount,
        long overdueOrderCount,
        BigDecimal averageCycleDays,
        BigDecimal averageOrderValue
) {
}
