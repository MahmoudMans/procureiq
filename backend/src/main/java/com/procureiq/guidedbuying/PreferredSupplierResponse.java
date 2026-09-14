package com.procureiq.guidedbuying;

import java.time.Instant;
import java.util.UUID;

public record PreferredSupplierResponse(
        UUID id,
        String category,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCountry,
        String supplierRiskLevel,
        double supplierRating,
        int preferenceRank,
        boolean active,
        String notes,
        UUID createdByUserId,
        String createdByName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
