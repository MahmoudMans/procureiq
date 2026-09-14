package com.procureiq.categorymanagement;

import java.util.List;

public record CategoryManagementDashboardResponse(
        CategoryManagementSummaryResponse summary,
        List<CategoryInsightResponse> categoryInsights,
        List<CategoryStrategySummaryResponse> strategies
) {
}
