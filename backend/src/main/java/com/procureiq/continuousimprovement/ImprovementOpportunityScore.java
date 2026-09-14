package com.procureiq.continuousimprovement;

import java.math.BigDecimal;

public record ImprovementOpportunityScore(
        BigDecimal score,
        ImprovementPriority priority
) {
}
