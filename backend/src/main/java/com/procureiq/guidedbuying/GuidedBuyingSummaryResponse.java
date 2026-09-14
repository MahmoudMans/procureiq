package com.procureiq.guidedbuying;

import java.math.BigDecimal;

public record GuidedBuyingSummaryResponse(
        long totalIntakes,
        long draftIntakes,
        long readyIntakes,
        long convertedIntakes,
        long competitiveSourcingRoutes,
        long riskReviewRoutes,
        long multiControlRoutes,
        long activeTemplates,
        long activePreferredSuppliers,
        BigDecimal openPipelineValue
) {
}
