package com.procureiq.negotiation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record NegotiationScenarioResponse(
        UUID id,
        UUID workspaceId,
        String name,
        NegotiationScenarioType scenarioType,
        BigDecimal totalValue,
        int paymentTermsDays,
        int leadTimeDays,
        int warrantyMonths,
        Integer volumeCommitment,
        BigDecimal priceSavings,
        BigDecimal savingsPct,
        BigDecimal scenarioScore,
        boolean preferred,
        String notes,
        UUID createdByUserId,
        String createdByName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
