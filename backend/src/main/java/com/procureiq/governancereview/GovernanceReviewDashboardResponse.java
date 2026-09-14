package com.procureiq.governancereview;

import java.util.List;

public record GovernanceReviewDashboardResponse(
        GovernanceReviewDashboardSummaryResponse summary,
        List<GovernanceReviewSummaryResponse> reviews
) {
}
