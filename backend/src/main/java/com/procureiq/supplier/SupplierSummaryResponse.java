package com.procureiq.supplier;

import java.math.BigDecimal;

public record SupplierSummaryResponse(
        long totalSuppliers,
        long activeSuppliers,
        long onboardingSuppliers,
        long highRiskSuppliers,
        BigDecimal averageRating,
        BigDecimal totalSpend,
        BigDecimal averageOnTimeDeliveryRate
) {
}
