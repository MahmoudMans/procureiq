package com.procureiq.supplierresilience;

import java.math.BigDecimal;
import java.util.UUID;

public record SupplierAlternativeResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String country,
        BigDecimal rating,
        String riskLevel,
        BigDecimal latestPerformanceScore
) {
}
