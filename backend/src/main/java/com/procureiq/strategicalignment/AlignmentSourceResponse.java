package com.procureiq.strategicalignment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AlignmentSourceResponse(
        AlignmentSourceType sourceType,
        UUID sourceEntityId,
        String sourceReference,
        String sourceTitle,
        String sourceStatus,
        BigDecimal strategicValue,
        BigDecimal riskExposure,
        BigDecimal riskScore,
        LocalDate dueDate,
        BigDecimal directAllocationPct,
        int linkedObjectiveCount,
        int okrContributionCount,
        AlignmentStatus alignmentStatus,
        boolean splitCommitment,
        int deadlineConflictCount
) {
}
