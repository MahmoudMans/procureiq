package com.procureiq.supplierportal;

import com.procureiq.suppliercollaboration.CollaborationPriority;
import com.procureiq.suppliercollaboration.CollaborationWorkspaceStatus;
import com.procureiq.suppliercollaboration.CollaborationWorkspaceType;

import java.time.Instant;
import java.util.UUID;

public record SupplierPortalWorkspaceResponse(
        UUID id,
        String workspaceNumber,
        CollaborationWorkspaceType workspaceType,
        CollaborationWorkspaceStatus status,
        CollaborationPriority priority,
        String title,
        String purchaseOrderNumber,
        String rfqNumber,
        String externalReference,
        int supplierResponseSlaHours,
        Instant responseDueAt,
        boolean responseSlaBreached,
        long openSupplierActions,
        long overdueSupplierActions,
        Instant lastMessageAt,
        Instant createdAt,
        Instant updatedAt
) {
}
