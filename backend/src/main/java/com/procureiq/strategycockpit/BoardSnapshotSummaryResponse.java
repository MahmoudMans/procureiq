package com.procureiq.strategycockpit;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BoardSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        String currency,
        int fiscalYear,
        BigDecimal overallScore,
        BoardHealth overallHealth,
        BigDecimal scoreDelta,
        BoardMovement movement,
        int exceptionCount,
        int criticalExceptionCount,
        String boardCommentary,
        String capturedByName,
        Instant capturedAt
) {
}
