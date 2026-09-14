package com.procureiq.suppliermonitoring;

import java.math.BigDecimal;

public record SupplierRiskFactorResponse(
        SupplierRiskFactorCode factorCode,
        BigDecimal factorScore,
        BigDecimal weightPct,
        BigDecimal contribution,
        String details
) {
}
