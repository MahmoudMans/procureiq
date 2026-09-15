package com.procureiq.capacityplanning;

import java.math.BigDecimal;

public record CapacityScoreResult(
        BigDecimal estimationCoveragePct,
        BigDecimal assignmentCoveragePct,
        BigDecimal capacityCoveragePct,
        BigDecimal deadlineHealthPct,
        BigDecimal capacityScore,
        CapacityHealth health
) {
}
