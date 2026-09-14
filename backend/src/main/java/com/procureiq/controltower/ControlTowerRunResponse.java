package com.procureiq.controltower;

import java.time.Instant;
import java.util.UUID;

public record ControlTowerRunResponse(
        UUID id,
        String currency,
        String status,
        String startedByName,
        int discoveredCount,
        int refreshedCount,
        int autoResolvedCount,
        Instant startedAt,
        Instant completedAt
) {
}
