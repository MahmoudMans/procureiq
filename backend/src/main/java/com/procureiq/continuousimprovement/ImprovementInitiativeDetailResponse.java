package com.procureiq.continuousimprovement;

import java.math.BigDecimal;
import java.util.List;

public record ImprovementInitiativeDetailResponse(
        ImprovementInitiativeSummaryResponse initiative,
        String description,
        String notes,

        ImprovementMetricVector baseline,

        BigDecimal targetSlaAttainmentPct,
        BigDecimal targetSlaOverdueReductionPct,
        BigDecimal targetPersistentReductionPct,
        BigDecimal targetResolutionHoursReductionPct,
        BigDecimal targetExposureReductionPct,

        List<ImprovementActionResponse> actions,
        List<ImprovementCheckpointResponse> checkpoints
) {
}
