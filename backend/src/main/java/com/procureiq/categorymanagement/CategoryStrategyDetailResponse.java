package com.procureiq.categorymanagement;

import java.util.List;

public record CategoryStrategyDetailResponse(
        CategoryStrategySummaryResponse strategy,
        String objectives,
        CategoryInsightResponse currentInsight,
        List<CategorySupplierLandscapeResponse> supplierLandscape,
        List<CategoryInitiativeResponse> initiatives
) {
}
