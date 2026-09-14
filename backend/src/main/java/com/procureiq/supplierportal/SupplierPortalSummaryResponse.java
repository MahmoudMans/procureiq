package com.procureiq.supplierportal;

public record SupplierPortalSummaryResponse(
        long activeWorkspaces,
        long waitingSupplier,
        long overdueResponses,
        long openActions,
        long overdueActions
) {
}
