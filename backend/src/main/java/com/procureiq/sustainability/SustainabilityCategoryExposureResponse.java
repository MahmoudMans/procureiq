package com.procureiq.sustainability;

import java.math.BigDecimal;

public record SustainabilityCategoryExposureResponse(
        String category,
        long supplierCount,
        long assessedSuppliers,
        long highRiskSuppliers,
        BigDecimal totalSpend,
        BigDecimal assessedSpend,
        BigDecimal riskSpend,
        BigDecimal coveragePct
) {
}
