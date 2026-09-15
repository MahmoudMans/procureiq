package com.procureiq.strategyscenario;

import java.util.List;

public record StrategyScenarioEvaluationDetailResponse(
        StrategyScenarioEvaluationSummaryResponse evaluation,
        String generatedSummary,
        List<StrategyScenarioEvaluationDimensionResponse> dimensions
) {
}
