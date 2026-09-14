package com.procureiq.continuousimprovement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ImprovementCheckpointResponse(
        UUID id,
        UUID snapshotId,
        String snapshotNumber,
        long currentActiveCount,
        long currentSlaOverdueCount,
        long currentPersistentCount,
        long currentResolvedCount,
        BigDecimal currentSlaAttainmentPct,
        BigDecimal currentAvgResolutionHours,
        BigDecimal currentAvgActiveAgeDays,
        BigDecimal currentActiveExposure,
        BigDecimal slaAttainmentDelta,
        BigDecimal slaOverdueReductionPct,
        BigDecimal persistentReductionPct,
        BigDecimal resolutionHoursReductionPct,
        BigDecimal exposureReductionPct,
        int targetsMetCount,
        BigDecimal achievementScore,
        ImprovementOutcome outcome,
        String capturedByName,
        Instant capturedAt
) {
}
