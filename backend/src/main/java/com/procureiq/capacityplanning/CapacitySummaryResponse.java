package com.procureiq.capacityplanning;

import java.math.BigDecimal;

public record CapacitySummaryResponse(
        int strategicSourceCount,
        int estimatedSourceCount,
        int fullyAssignedSourceCount,
        int unassignedSourceCount,
        int profileCount,
        BigDecimal effectiveCapacityHours,
        BigDecimal estimatedDemandHours,
        BigDecimal assignedDemandHours,
        BigDecimal unassignedDemandHours,
        BigDecimal capacityGapHours,
        BigDecimal estimationCoveragePct,
        BigDecimal assignmentCoveragePct,
        BigDecimal capacityCoveragePct,
        BigDecimal deadlineHealthPct,
        BigDecimal capacityScore,
        CapacityHealth portfolioHealth,
        int overloadedMemberCount,
        int criticalMemberCount,
        int deadlinePressureCount
) {
}
