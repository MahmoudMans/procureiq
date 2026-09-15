package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardDimensionKey;
import com.procureiq.strategycockpit.BoardHealth;

import java.math.BigDecimal;

public record StrategyScenarioEvaluationDimensionResponse(
        BoardDimensionKey dimensionKey,
        String dimensionLabel,
        BigDecimal weightPct,
        BigDecimal baselineScore,
        BigDecimal adjustmentPoints,
        BigDecimal simulatedScore,
        BigDecimal weightedContribution,
        BoardHealth health
) {
}
