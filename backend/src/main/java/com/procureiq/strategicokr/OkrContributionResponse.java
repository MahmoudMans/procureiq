package com.procureiq.strategicokr;

import java.math.BigDecimal;
import java.util.UUID;

public record OkrContributionResponse(
        UUID id,
        UUID improvementInitiativeId,
        String initiativeNumber,
        String initiativeTitle,
        String initiativeStatus,
        BigDecimal contributionWeightPct,
        String rationale
) {
}
