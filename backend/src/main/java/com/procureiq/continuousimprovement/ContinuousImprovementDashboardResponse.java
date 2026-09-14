package com.procureiq.continuousimprovement;

import java.util.List;

public record ContinuousImprovementDashboardResponse(
        String currency,
        ImprovementSnapshotOptionResponse latestSnapshot,
        List<ImprovementOpportunityResponse> opportunities,
        List<ImprovementInitiativeSummaryResponse> initiatives
) {
}
