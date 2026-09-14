package com.procureiq.suppliermonitoring;

import java.time.Instant;
import java.util.UUID;

public record SupplierRiskWatchlistResponse(
        UUID id,
        UUID supplierId,
        SupplierRiskWatchlistStatus status,
        String reason,
        String addedByName,
        Instant addedAt,
        String releasedByName,
        String releaseNote,
        Instant releasedAt
) {
}
