package com.procureiq.planning;

import java.util.List;

public record ProcurementPlanDetailResponse(
        ProcurementPlanResponse plan,
        List<ProcurementPlanItemResponse> items
) {
}
