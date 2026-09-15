package com.procureiq.outcomepersistence;

import java.util.List;

public record PersistenceReviewDetailResponse(
        PersistenceReviewSummaryResponse review,
        List<PersistenceReviewItemResponse> items
) {
}
