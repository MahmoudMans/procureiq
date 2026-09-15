package com.procureiq.strategicalignment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record AlignmentReviewSummaryResponse(
        UUID id,
        String reviewNumber,
        String currency,
        int fiscalYear,
        BigDecimal alignmentScore,
        AlignmentHealth alignmentHealth,
        int alignedSourceCount,
        int unalignedSourceCount,
        int deadlineConflictCount,
        String capturedByName,
        Instant capturedAt
) {
}
