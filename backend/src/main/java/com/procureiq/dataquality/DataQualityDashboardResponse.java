package com.procureiq.dataquality;

import java.util.List;

public record DataQualityDashboardResponse(
        DataQualitySummaryResponse summary,
        List<DataQualityDomainScoreResponse> domainScores,
        List<DataQualityFindingResponse> findings,
        List<DataQualityRuleResponse> rules
) {
}
