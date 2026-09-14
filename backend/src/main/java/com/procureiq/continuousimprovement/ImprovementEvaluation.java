package com.procureiq.continuousimprovement;

import java.math.BigDecimal;

public record ImprovementEvaluation(
        BigDecimal slaAttainmentDelta,
        BigDecimal slaOverdueReductionPct,
        BigDecimal persistentReductionPct,
        BigDecimal resolutionHoursReductionPct,
        BigDecimal exposureReductionPct,
        int targetsMetCount,
        BigDecimal achievementScore,
        ImprovementOutcome outcome
) {
}
