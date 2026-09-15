package com.procureiq.capabilityplanning;

import java.math.BigDecimal;

public record CapabilitySummaryResponse(
        int activeSkillCount,
        int assessedMemberCount,
        int strategicWorkCount,
        int workWithRequirementsCount,
        int readyWorkCount,
        int watchWorkCount,
        int gapWorkCount,
        int criticalWorkCount,
        int criticalGapCount,
        int openDevelopmentActionCount,
        BigDecimal requirementCoveragePct,
        BigDecimal averageAssignedFitPct,
        BigDecimal averageBenchFitPct,
        BigDecimal capabilityScore,
        CapabilityReadiness capabilityHealth
) {
}
