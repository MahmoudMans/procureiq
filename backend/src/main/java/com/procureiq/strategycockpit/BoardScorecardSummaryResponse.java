package com.procureiq.strategycockpit;

import java.math.BigDecimal;

public record BoardScorecardSummaryResponse(
        String currency,
        int fiscalYear,
        BigDecimal objectiveExecutionScore,
        BigDecimal strategicAlignmentScore,
        BigDecimal capacityScore,
        BigDecimal capabilityScore,
        BigDecimal successionScore,
        BigDecimal overallScore,
        BoardHealth overallHealth,
        BigDecimal previousOverallScore,
        BigDecimal scoreDelta,
        BoardMovement movement,
        int strategicObjectiveCount,
        int offTrackObjectiveCount,
        int unalignedWorkCount,
        int overloadedMemberCount,
        int criticalCapabilityGapCount,
        int successionSpofCount,
        int exceptionCount,
        int criticalExceptionCount,
        String generatedSummary
) {
}
