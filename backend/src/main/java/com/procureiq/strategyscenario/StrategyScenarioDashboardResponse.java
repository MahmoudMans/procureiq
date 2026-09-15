package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardScorecardSummaryResponse;

import java.util.List;

public record StrategyScenarioDashboardResponse(
        String currency,
        int fiscalYear,
        BoardScorecardSummaryResponse liveBoardBaseline,
        List<StrategyScenarioSummaryResponse> scenarios
) {
}
