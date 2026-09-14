package com.procureiq.executive;

import java.time.Instant;
import java.util.List;

public record ExecutiveCockpitResponse(
        ExecutiveCockpitSummaryResponse summary,
        List<ExecutivePortfolioSignalResponse> portfolioSignals,
        List<ExecutiveWarningResponse> warnings,
        List<ExecutiveManagementActionResponse> managementActions,
        List<ExecutiveRuleResponse> rules,
        Instant generatedAt
) {
}
