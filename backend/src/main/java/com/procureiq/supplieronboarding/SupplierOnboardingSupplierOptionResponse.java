package com.procureiq.supplieronboarding;

import java.util.UUID;

public record SupplierOnboardingSupplierOptionResponse(
        UUID id,
        String supplierCode,
        String supplierName,
        String category,
        String country,
        String status,
        String riskLevel
) {
}
