package com.procureiq.suppliercollaboration;

import java.util.List;

public record SupplierCollaborationDashboardResponse(
        CollaborationSummaryResponse summary,
        List<CollaborationWorkspaceListResponse> workspaces,
        List<SupplierCollaborationMetricResponse> supplierMetrics
) {
}
