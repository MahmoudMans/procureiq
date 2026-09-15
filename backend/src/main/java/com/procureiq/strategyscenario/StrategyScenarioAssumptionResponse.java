package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardDimensionKey;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StrategyScenarioAssumptionResponse(
        UUID id,
        BoardDimensionKey dimensionKey,
        String dimensionLabel,
        BigDecimal adjustmentPoints,
        String rationale,
        String createdByName,
        String updatedByName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
