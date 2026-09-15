package com.procureiq.strategicvalue;

import java.util.List;

public record StrategicValueReviewDetailResponse(
        StrategicValueReviewSummaryResponse review,
        List<StrategicValueReviewItemResponse> items
) {
}
