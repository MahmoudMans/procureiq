package com.procureiq.suppliercollaboration;

import java.math.BigDecimal;
import java.util.UUID;

public record SupplierCollaborationMetricResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        long activeWorkspaces,
        long waitingSupplier,
        long responseSlaBreaches,
        long openActions,
        long overdueActions,
        long supplierResponseCount,
        BigDecimal averageSupplierResponseHours
) {
}
