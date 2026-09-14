package com.procureiq.governancereview;

import java.util.List;

public record GovernanceReviewDetailResponse(
        GovernanceReviewSummaryResponse review,
        String executiveSummary,
        GovernanceSnapshotMetricsResponse snapshot,
        List<GovernanceSnapshotItemResponse> snapshotItems,
        List<GovernanceDecisionResponse> decisions,
        List<GovernanceActionResponse> actions
) {
}
