package com.procureiq.strategyscenario;

import java.util.List;

public record StrategyScenarioDetailResponse(
        StrategyScenarioSummaryResponse scenario,
        List<StrategyScenarioAssumptionResponse> assumptions,
        StrategyScenarioEvaluationDetailResponse latestEvaluation
) {
}
