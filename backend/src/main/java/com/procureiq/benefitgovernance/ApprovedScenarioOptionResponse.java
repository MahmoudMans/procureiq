package com.procureiq.benefitgovernance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ApprovedScenarioOptionResponse(
        UUID id,
        String scenarioCode,
        String name,
        String currency,
        String ownerName,
        long selectedInitiatives,
        BigDecimal selectedBudget,
        BigDecimal targetSavings,
        BigDecimal averageRisk,
        Instant approvedAt
) {
}
