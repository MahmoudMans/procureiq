package com.procureiq.supplierperformance;

import java.math.BigDecimal;
import java.util.UUID;

public record PerformanceSupplierOptionResponse(
        UUID id,
        String supplierCode,
        String legalName,
        String category,
        String country,
        BigDecimal rating,
        String riskLevel
) {
}
