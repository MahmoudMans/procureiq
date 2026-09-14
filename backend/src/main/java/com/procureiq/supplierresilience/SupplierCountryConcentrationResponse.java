package com.procureiq.supplierresilience;

import java.math.BigDecimal;

public record SupplierCountryConcentrationResponse(
        String country,
        String currency,
        long supplierCount,
        BigDecimal spend,
        BigDecimal spendSharePct
) {
}
