package com.procureiq.analytics;

import java.util.List;

public record ProcurementAnalyticsResponse(
        AnalyticsSummaryResponse summary,
        List<MonthlySpendResponse> monthlySpend,
        List<AnalyticsBreakdownResponse> spendBySupplier,
        List<AnalyticsBreakdownResponse> spendByCategory,
        List<AnalyticsBreakdownResponse> spendByDepartment,
        List<AnalyticsBreakdownResponse> riskExposure,
        List<AnalyticsBreakdownResponse> purchaseOrderPipeline
) {
}
