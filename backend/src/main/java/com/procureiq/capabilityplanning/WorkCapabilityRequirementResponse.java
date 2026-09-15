package com.procureiq.capabilityplanning;

import java.math.BigDecimal;
import java.util.UUID;

public record WorkCapabilityRequirementResponse(
        UUID id,
        String currency,
        int fiscalYear,
        CapabilitySourceType sourceType,
        UUID sourceEntityId,
        String sourceReference,
        String sourceTitle,
        UUID skillId,
        String skillCode,
        String skillName,
        String skillCategory,
        int requiredProficiency,
        BigDecimal importanceWeightPct
) {
}
