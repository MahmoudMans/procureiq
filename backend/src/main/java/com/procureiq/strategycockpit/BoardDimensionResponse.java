package com.procureiq.strategycockpit;

import java.math.BigDecimal;

public record BoardDimensionResponse(
        BoardDimensionKey key,
        String label,
        BigDecimal weightPct,
        BigDecimal score,
        BigDecimal weightedContribution,
        BoardHealth health,
        BigDecimal previousScore,
        BigDecimal scoreDelta,
        String sourceDetail
) {
}
