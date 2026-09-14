package com.procureiq.supplierportal;

import java.util.List;

public record SupplierPortalDashboardResponse(
        SupplierPortalProfileResponse profile,
        SupplierPortalSummaryResponse summary,
        List<SupplierPortalWorkspaceResponse> workspaces
) {
}
