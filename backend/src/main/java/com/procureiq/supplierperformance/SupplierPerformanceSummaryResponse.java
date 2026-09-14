package com.procureiq.supplierperformance;

import java.math.BigDecimal;

public record SupplierPerformanceSummaryResponse(
        long totalReviews,
        long reviewedSuppliers,
        long pendingApproval,
        long needsImprovement,
        long criticalReviews,
        long openCorrectiveActions,
        long overdueCorrectiveActions,
        BigDecimal averageApprovedScore
) {
}
