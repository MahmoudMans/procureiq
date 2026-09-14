package com.procureiq.continuousimprovement;

import java.math.BigDecimal;
import java.util.UUID;

public record ImprovementOpportunityResponse(
        UUID snapshotId,
        String snapshotNumber,
        ImprovementScopeType scopeType,
        String scopeKey,
        String scopeLabel,
        BigDecimal opportunityScore,
        ImprovementPriority priority,
        long activeCount,
        long slaOverdueCount,
        long persistentCount,
        long resolvedCount,
        BigDecimal slaAttainmentPct,
        BigDecimal avgResolutionHours,
        BigDecimal avgActiveAgeDays,
        BigDecimal activeExposure,
        BigDecimal workloadSharePct,
        String rationale
) {
}
