package com.procureiq.strategicalignment;

import java.util.List;

public record StrategicAlignmentDashboardResponse(
        String currency,
        int fiscalYear,
        StrategicAlignmentSummaryResponse summary,
        List<ObjectiveAlignmentSummaryResponse> objectives,
        List<AlignmentSourceResponse> sources,
        List<AlignmentReviewSummaryResponse> reviews
) {
}
