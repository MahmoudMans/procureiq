package com.procureiq.supplierdocument;

import com.procureiq.supplierportal.SupplierPortalProfileResponse;

import java.util.List;

public record SupplierPortalDocumentDashboardResponse(
        SupplierPortalProfileResponse profile,
        SupplierPortalDocumentSummaryResponse summary,
        List<SupplierComplianceItemResponse> documents
) {
}
