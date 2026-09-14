package com.procureiq.suppliercollaboration;

import java.math.BigDecimal;

public record CollaborationSummaryResponse(
        long activeWorkspaces,
        long waitingSupplier,
        long waitingInternal,
        long responseSlaBreaches,
        long openActions,
        long overdueActions,
        long supplierSharedMessages,
        long recordedSupplierResponses,
        BigDecimal averageSupplierResponseHours
) {
}
