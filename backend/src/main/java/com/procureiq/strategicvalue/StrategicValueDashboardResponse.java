package com.procureiq.strategicvalue;

import java.util.List;

public record StrategicValueDashboardResponse(
        StrategicValueSummaryResponse summary,
        List<StrategicValueUserOptionResponse> users,
        List<StrategicValueCandidateResponse> candidates,
        List<StrategicValueCaseResponse> cases,
        List<StrategicValueReviewSummaryResponse> reviews
) {
}
