package com.procureiq.sustainability;

import java.util.UUID;

public record SustainabilitySupplierOptionResponse(
        UUID id,
        String supplierCode,
        String supplierName,
        String category,
        String country,
        String status,
        String riskLevel
) {
}
