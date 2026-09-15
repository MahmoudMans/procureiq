package com.procureiq.strategicalignment;

import java.util.List;

public record AlignmentReviewDetailResponse(
        AlignmentReviewSummaryResponse review,
        StrategicAlignmentSummaryResponse summary,
        List<AlignmentSourceResponse> sources
) {
}
