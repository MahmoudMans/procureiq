package com.procureiq.controltower;

import java.util.UUID;

public record ControlTowerScanResponse(
        UUID runId,
        int sourceExceptions,
        int discoveredCount,
        int refreshedCount,
        int autoResolvedCount
) {
}
