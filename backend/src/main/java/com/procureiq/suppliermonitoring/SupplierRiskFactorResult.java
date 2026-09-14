package com.procureiq.suppliermonitoring;

import java.math.BigDecimal;

public record SupplierRiskFactorResult(
        SupplierRiskFactorCode factorCode,
        BigDecimal factorScore,
        BigDecimal weightPct,
        BigDecimal contribution,
        String details
) {
}
