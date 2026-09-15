package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardHealth;
import com.procureiq.strategycockpit.BoardMovement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StrategyScenarioEvaluationSummaryResponse(
        UUID id,
        String evaluationNumber,
        UUID scenarioId,
        BigDecimal baselineOverallScore,
        BigDecimal simulatedOverallScore,
        BoardHealth simulatedHealth,
        BigDecimal scoreDelta,
        BoardMovement movement,
        int assumptionCount,
        int improvedDimensionCount,
        int deterioratedDimensionCount,
        String evaluatedByName,
        Instant evaluatedAt
) {
}
