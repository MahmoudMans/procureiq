package com.procureiq.supplierperformance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SupplierPerformanceTrendResponse(
        UUID reviewId,
        String reviewNumber,
        LocalDate periodEnd,
        BigDecimal weightedScore,
        SupplierPerformanceBand performanceBand,
        SupplierPerformanceReviewStatus status
) {
}
