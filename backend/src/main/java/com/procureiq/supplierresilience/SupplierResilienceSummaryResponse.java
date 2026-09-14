package com.procureiq.supplierresilience;

import java.math.BigDecimal;

public record SupplierResilienceSummaryResponse(
        String currency,
        long suppliersEvaluated,
        long strategicCriticalSuppliers,
        long vulnerableSuppliers,
        long criticalResilienceSuppliers,
        long singleSourceSuppliers,
        long dependencyBreaches,
        long constrainedCapacitySuppliers,
        long openMitigationActions,
        long overdueMitigationActions,
        BigDecimal averageResilienceScore,
        BigDecimal spendAtRisk
) {
}
