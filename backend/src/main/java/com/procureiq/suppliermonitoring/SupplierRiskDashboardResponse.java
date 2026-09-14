package com.procureiq.suppliermonitoring;

import java.util.List;

public record SupplierRiskDashboardResponse(
        SupplierRiskSummaryResponse summary,
        List<SupplierRiskPortfolioItemResponse> suppliers,
        List<SupplierRiskAlertResponse> alerts
) {
}
