package com.procureiq.supplierportal;

import java.util.List;

public record SupplierPortalWorkspaceDetailResponse(
        SupplierPortalWorkspaceResponse workspace,
        List<SupplierPortalMessageResponse> messages,
        List<SupplierPortalActionResponse> actions
) {
}
