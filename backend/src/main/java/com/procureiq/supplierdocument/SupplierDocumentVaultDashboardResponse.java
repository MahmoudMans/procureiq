package com.procureiq.supplierdocument;

import java.util.List;

public record SupplierDocumentVaultDashboardResponse(
        SupplierDocumentVaultSummaryResponse summary,
        List<SupplierComplianceItemResponse> items,
        List<SupplierDocumentRequirementResponse> requirements
) {
}
