package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardDimensionKey;
import com.procureiq.strategycockpit.BoardHealth;

import java.math.BigDecimal;

public record ScenarioDimensionResult(
        BoardDimensionKey key,
        BigDecimal weightPct,
        BigDecimal baselineScore,
        BigDecimal adjustmentPoints,
        BigDecimal simulatedScore,
        BigDecimal weightedContribution,
        BoardHealth health
) {
}
