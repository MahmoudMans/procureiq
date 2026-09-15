package com.procureiq.outcomepersistence;

import java.util.List;

public record OutcomePersistenceDashboardResponse(
        OutcomePersistenceSummaryResponse summary,
        List<PersistenceUserOptionResponse> users,
        List<PersistenceCandidateResponse> candidates,
        List<PersistencePlanResponse> plans,
        List<PersistenceReviewSummaryResponse> reviews
) {
}
