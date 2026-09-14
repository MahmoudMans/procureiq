package com.procureiq.strategicokr;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OkrSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID objectiveId,
        BigDecimal overallProgressPct,
        StrategicHealth overallHealth,
        BigDecimal overallConfidencePct,
        int keyResultCount,
        int achievedKeyResultCount,
        String capturedByName,
        Instant capturedAt
) {
}
