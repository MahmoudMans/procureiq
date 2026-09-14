package com.procureiq.categorymanagement;

import java.math.BigDecimal;

public record CategoryInsightResponse(
        String categoryName,
        String currency,
        long supplierCount,
        BigDecimal totalSpend,
        BigDecimal topSupplierSpendShare,
        long highRiskSuppliers,
        BigDecimal weightedSupplierRiskScore,
        BigDecimal strategicValueScore,
        BigDecimal modeledOpportunityPct,
        BigDecimal modeledOpportunityAmount,
        CategoryMatrixPosition matrixPosition
) {
}
