package com.procureiq.supplierperformance;

import java.util.List;

public record SupplierPerformanceReviewDetailResponse(
        SupplierPerformanceReviewResponse review,
        List<CorrectiveActionResponse> correctiveActions,
        List<SupplierPerformanceTrendResponse> supplierHistory
) {
}
