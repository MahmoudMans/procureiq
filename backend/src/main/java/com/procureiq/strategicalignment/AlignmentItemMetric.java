package com.procureiq.strategicalignment;

import java.math.BigDecimal;

public record AlignmentItemMetric(
        BigDecimal strategicValue,
        BigDecimal riskExposure,
        BigDecimal allocationPct,
        int linkedObjectiveCount,
        int deadlineConflictCount
) {
}
