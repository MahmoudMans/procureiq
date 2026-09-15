package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardHealth;
import com.procureiq.strategycockpit.BoardMovement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StrategyScenarioSummaryResponse(
        UUID id,
        String scenarioNumber,
        String name,
        String description,
        String currency,
        int fiscalYear,
        StrategyScenarioStatus status,
        BigDecimal baselineOverallScore,
        BoardHealth baselineHealth,
        BigDecimal latestSimulatedScore,
        BoardHealth latestSimulatedHealth,
        BigDecimal latestDelta,
        BoardMovement latestMovement,
        int assumptionCount,
        int rank,
        String approvalNote,
        String approvedByName,
        Instant approvedAt,
        String archiveNote,
        String createdByName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
